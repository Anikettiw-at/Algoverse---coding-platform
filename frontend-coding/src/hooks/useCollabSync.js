/**
 * hooks/useCollabSync.js
 *
 * Monaco editor instance ko `/collab` namespace se jodta hai. Delta-based
 * sync use karta hai (poora document diff nahi karta) — collabSocket.js
 * (backend) me isi approach ka detail note likha hai.
 *
 * USAGE (kisi Peer-Mock / pair-programming page me):
 *
 *   const editorRef = useRef(null);
 *   const monacoRef = useRef(null);
 *   const { broadcastLocalChange, broadcastCursorPosition,
 *           broadcastLanguageChange, broadcastThemeChange } =
 *     useCollabSync({ editorRef, monacoRef, roomId, onLanguageChange: setLanguage, onThemeChange: setTheme });
 *
 *   <Editor
 *     onMount={(editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco; }}
 *     onChange={(_, event) => broadcastLocalChange(event)}
 *   />
 */
import { useEffect, useRef, useCallback } from 'react';
import { getCollabSocket } from '../utils/socket';

export default function useCollabSync({ editorRef, monacoRef, roomId, onLanguageChange, onThemeChange }) {
  // Jab hum remote change apply kar rahe hote hain, editor apna
  // onDidChangeModelContent phir se fire karega — is flag se us echo
  // ko wapas server ko bhejne se rokte hain (infinite loop na bane).
  const isApplyingRemoteChange = useRef(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    const socket = getCollabSocket();
    socketRef.current = socket;
    if (!socket.connected) socket.connect();

    socket.emit('collab:join_room', { roomId });

    function handleSyncState({ code, language, theme }) {
      const editor = editorRef.current;
      if (!editor) return;
      isApplyingRemoteChange.current = true;
      editor.setValue(code ?? '');
      isApplyingRemoteChange.current = false;
      onLanguageChange?.(language);
      onThemeChange?.(theme);
    }

    function handleRemoteChange({ changes }) {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco || !Array.isArray(changes)) return;

      isApplyingRemoteChange.current = true;
      const edits = changes.map((change) => ({
        range: new monaco.Range(
          change.range.startLineNumber,
          change.range.startColumn,
          change.range.endLineNumber,
          change.range.endColumn
        ),
        text: change.text,
        forceMoveMarkers: true,
      }));
      editor.executeEdits('remote-collab', edits);
      isApplyingRemoteChange.current = false;
    }

    function handleRemoteLanguageChange({ language }) {
      onLanguageChange?.(language);
    }

    function handleRemoteThemeChange({ theme }) {
      onThemeChange?.(theme);
    }

    socket.on('collab:sync_state', handleSyncState);
    socket.on('collab:remote_change', handleRemoteChange);
    socket.on('collab:remote_language_change', handleRemoteLanguageChange);
    socket.on('collab:remote_theme_change', handleRemoteThemeChange);

    return () => {
      socket.off('collab:sync_state', handleSyncState);
      socket.off('collab:remote_change', handleRemoteChange);
      socket.off('collab:remote_language_change', handleRemoteLanguageChange);
      socket.off('collab:remote_theme_change', handleRemoteThemeChange);
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Editor ke onChange (2nd arg = ChangeEvent) me isko call karo */
  const broadcastLocalChange = useCallback(
    (changeEvent) => {
      if (isApplyingRemoteChange.current) return; // apna hi echo hai, ignore karo
      const socket = socketRef.current;
      if (!socket || !roomId || !changeEvent?.changes) return;

      const changes = changeEvent.changes.map((c) => ({
        range: {
          startLineNumber: c.range.startLineNumber,
          startColumn: c.range.startColumn,
          endLineNumber: c.range.endLineNumber,
          endColumn: c.range.endColumn,
        },
        text: c.text,
      }));
      socket.emit('collab:code_change', { roomId, changes });
    },
    [roomId]
  );

  const broadcastCursorPosition = useCallback(
    (position, selection) => {
      socketRef.current?.emit('collab:cursor_position', { roomId, position, selection });
    },
    [roomId]
  );

  const broadcastLanguageChange = useCallback(
    (language) => {
      socketRef.current?.emit('collab:language_change', { roomId, language });
    },
    [roomId]
  );

  const broadcastThemeChange = useCallback(
    (theme) => {
      socketRef.current?.emit('collab:theme_change', { roomId, theme });
    },
    [roomId]
  );

  return {
    broadcastLocalChange,
    broadcastCursorPosition,
    broadcastLanguageChange,
    broadcastThemeChange,
  };
}