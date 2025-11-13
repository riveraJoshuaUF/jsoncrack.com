import React, { useState, useEffect } from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// Extracts a nested value from a JSON string using the given path
const readValueAtPath = (json: string, path?: NodeData["path"]): any => {
  try {
    const obj = JSON.parse(json);
    if (!path || path.length === 0) return obj;

    let current: any = obj;
    for (let i = 0; i < path.length; i++) {
      current = current?.[path[i]];
    }
    return current;
  } catch (error) {
    console.error("Error retrieving value from JSON path:", error);
    return null;
  }
};

// Converts node text rows into a clean JSON string (ignores nested structures)
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) {
    return JSON.stringify(nodeRows[0].value);
  }
  const obj: Record<string, any> = {};
  nodeRows.forEach(row => {
    if (row.key) obj[row.key] = row.value;
  });
  return JSON.stringify(obj, null, 2);
};

// Formats a node path into a readable JSONPath-like syntax
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Rewrites a JSON string by updating a value at the provided path
const writeJsonAtPath = (json: string, path?: NodeData["path"], newValue?: any): string => {
  try {
    const obj = JSON.parse(json);
    if (!path || path.length === 0) return JSON.stringify(newValue, null, 2);

    let current: any = obj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = newValue;

    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error("Error applying changes to JSON path:", error);
    return json;
  }
};

// Converts text input into a valid JSON-compatible value if possible
const coerceInputValue = (content: string): any => {
  const trimmed = content.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return content;
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");

  // Refreshes modal contents when a node is opened or selected
  useEffect(() => {
    if (nodeData) {
      const jsonStr = useJson.getState().json;
      const full = readValueAtPath(jsonStr, nodeData.path);
      const initialText =
        full !== null && full !== undefined
          ? typeof full === "object"
            ? JSON.stringify(full, null, 2)
            : String(full)
          : normalizeNodeData(nodeData.text ?? []);
      setDraft(initialText);
      setBaseline(initialText);
    }
  }, [nodeData, opened]);

  // Adds keyboard support for canceling edit with Esc
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        revertEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft, baseline]);

  // Starts edit mode
  const beginEdit = () => setEditing(true);

  // Saves edits and pushes updates to stores and graph
  const commitEdit = () => {
    try {
      const newValue = coerceInputValue(draft);

      const jsonStr = useJson.getState().json;
      const originalFull = readValueAtPath(jsonStr, nodeData?.path);

      // Merge shallow objects to keep child keys intact
      const merged =
        originalFull &&
        typeof originalFull === "object" &&
        !Array.isArray(originalFull) &&
        newValue &&
        typeof newValue === "object" &&
        !Array.isArray(newValue)
          ? { ...originalFull, ...newValue }
          : newValue;

      const updated = writeJsonAtPath(jsonStr, nodeData?.path, merged);

      // Syncs JSON state, file state, and visualization
      useJson.getState().setJson(updated);
      useFile.getState().setContents({ contents: updated, hasChanges: true });

      try {
        useGraph.getState().setGraph(JSON.parse(updated));
      } catch {
        useGraph.getState().setGraph(updated as any);
      }

      setEditing(false);
      setBaseline(draft);
    } catch (error) {
      console.error("Error when saving node changes:", error);
      alert("An issue occurred while saving your changes");
    }
  };

  // Cancels editing and restores previous content
  const revertEdit = () => {
    setDraft(baseline);
    setEditing(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Node Details
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>

          {editing ? (
            <Textarea
              aria-label="Node JSON editor"
              value={draft}
              onChange={e => setDraft(e.currentTarget.value)}
              placeholder="Edit JSON value"
              autosize
              minRows={6}
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "12px",
                },
              }}
            />
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={draft}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>

        <Text fz="xs" fw={500}>Path Reference</Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy"
            copiedLabel="Copied!"
            withCopyButton
          />
        </ScrollArea.Autosize>

        <Flex gap="sm" justify="flex-end" pt="sm">
          {editing ? (
            <>
              <Button variant="default" onClick={revertEdit}>
                Cancel
              </Button>
              <Button onClick={commitEdit} disabled={draft === baseline}>
                Save
              </Button>
            </>
          ) : (
            <Button onClick={beginEdit} aria-label="Edit node">
              Edit
            </Button>
          )}
        </Flex>
      </Stack>
    </Modal>
  );
};
