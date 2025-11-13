import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useMantineColorScheme } from "@mantine/core";
import "@mantine/dropzone/styles.css";
import styled, { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
// import Cookie from "js-cookie";
import { NextSeo } from "next-seo";
import { SEO } from "../constants/seo";
import { darkTheme, lightTheme } from "../constants/theme";
import { Banner } from "../features/Banner";
import { BottomBar } from "../features/editor/BottomBar";
import { FullscreenDropzone } from "../features/editor/FullscreenDropzone";
import { Toolbar } from "../features/editor/Toolbar";
import useGraph from "../features/editor/views/GraphView/stores/useGraph";
import useConfig from "../store/useConfig";
import useFile from "../store/useFile";

const ModalController = dynamic(() => import("../features/modals/ModalController"));
const ExternalMode = dynamic(() => import("../features/editor/ExternalMode"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const StyledPageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;

  @media only screen and (max-width: 320px) {
    height: 100vh;
  }
`;

export const StyledEditorWrapper = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

export const StyledEditor = styled(Allotment)`
  position: relative !important;
  display: flex;
  background: ${({ theme }) => theme.BACKGROUND_SECONDARY};

  @media only screen and (max-width: 320px) {
    height: 100vh;
  }
`;

const StyledTextEditor = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
`;

const TextEditor = dynamic(() => import("../features/editor/TextEditor"), {
  ssr: false,
});

const LiveEditor = dynamic(() => import("../features/editor/LiveEditor"), {
  ssr: false,
});

function setAtPath(root: any, tokens: Array<string | number>, value: any): any {
  if (!tokens || tokens.length === 0) return value;
  
  const [head, ...rest] = tokens;
  
  // clone root properly
  let cloned: any;
  if (Array.isArray(root)) {
    cloned = root.slice(); // shallow copy array
  } else if (root && typeof root === "object") {
    cloned = { ...root }; // shallow copy object
  } else {
    // root is null/undefined, create new container
    cloned = typeof head === "number" ? [] : {};
  }

  if (rest.length === 0) {
    // final assignment
    cloned[head as any] = value;
  } else {
    // recurse: get next level, recursively update it, assign back
    const nextLevel = cloned[head as any];
    cloned[head as any] = setAtPath(nextLevel, rest, value);
  }
  
  return cloned;
}

const EditorPage = () => {
  const { query, isReady } = useRouter();
  const { setColorScheme } = useMantineColorScheme();
  const checkEditorSession = useFile(state => state.checkEditorSession);
  const darkmodeEnabled = useConfig(state => state.darkmodeEnabled);
  const fullscreen = useGraph(state => state.fullscreen);

  useEffect(() => {
    if (isReady) checkEditorSession(query?.json);
  }, [checkEditorSession, isReady, query]);

  useEffect(() => {
    setColorScheme(darkmodeEnabled ? "dark" : "light");
  }, [darkmodeEnabled, setColorScheme]);

  // listen for nodeModalSave event and apply the edit to JSON
  useEffect(() => {
    const handleNodeSave = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { path, value } = customEvent.detail;

      try {
        // parse current contents
        const currentContents = useFile.getState().getContents();
        const currentJson = JSON.parse(currentContents);

        // apply the edit by path (path is an array of keys/indices)
        const updated = setAtPath(currentJson, path, value);
        const newContents = JSON.stringify(updated, null, 2);

        // update the file store (this updates left editor and visualization)
        useFile.getState().setContents({ contents: newContents, hasChanges: true });
      } catch (error) {
        console.error("Failed to apply node edit:", error);
      }
    };

    window.addEventListener("nodeModalSave", handleNodeSave);
    return () => window.removeEventListener("nodeModalSave", handleNodeSave);
  }, []);

  return (
    <>
      <NextSeo
        {...SEO}
        title="Editor | JSON Crack"
        description="JSON Crack Editor is a tool for visualizing into graphs, analyzing, editing, formatting, querying, transforming and validating JSON, CSV, YAML, XML, and more."
        canonical="https://jsoncrack.com/editor"
      />
      <ThemeProvider theme={darkmodeEnabled ? darkTheme : lightTheme}>
        <QueryClientProvider client={queryClient}>
          <ExternalMode />
          <ModalController />
          <StyledEditorWrapper>
            <StyledPageWrapper>
              {process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_MODE === "true" ? null : <Banner />}
              <Toolbar />
              <StyledEditorWrapper>
                <StyledEditor proportionalLayout={false}>
                  <Allotment.Pane
                    preferredSize={450}
                    minSize={fullscreen ? 0 : 300}
                    maxSize={800}
                    visible={!fullscreen}
                  >
                    <StyledTextEditor>
                      <TextEditor />
                      <BottomBar />
                    </StyledTextEditor>
                  </Allotment.Pane>
                  <Allotment.Pane minSize={0}>
                    <LiveEditor />
                  </Allotment.Pane>
                </StyledEditor>
                <FullscreenDropzone />
              </StyledEditorWrapper>
            </StyledPageWrapper>
          </StyledEditorWrapper>
        </QueryClientProvider>
      </ThemeProvider>
    </>
  );
};



export default EditorPage;
