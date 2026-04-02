import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { SmartCardProvider, CardClient } from '@atlaskit/link-provider';
import type EditorActions from '@atlaskit/editor-core/actions';

export interface AtlaskitDescriptionEditorHandle {
  getAdfValue: () => Promise<unknown | undefined>;
}

interface AtlaskitDescriptionEditorProps {
  defaultValue: unknown;
  disabled?: boolean;
}

const cardClient = new CardClient('staging');

const AtlaskitDescriptionEditorInner: React.ForwardRefRenderFunction<
  AtlaskitDescriptionEditorHandle,
  AtlaskitDescriptionEditorProps
> = ({ defaultValue, disabled }, ref) => {
  const actionsRef = useRef<EditorActions | null>(null);

  const onEditorReady = useCallback((editorActions: EditorActions) => {
    actionsRef.current = editorActions;
  }, []);

  useImperativeHandle(ref, () => ({
    getAdfValue: async () => {
      if (!actionsRef.current) return undefined;
      return actionsRef.current.getValue();
    },
  }), []);

  const [EditorComponent, setEditorComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    import('prosemirror-state').then(({ Selection }) => {
      const orig = Selection.jsonID;
      Selection.jsonID = function (id: string, cls: any) {
        try { return orig.call(this, id, cls); } catch { return cls; }
      };
    }).catch(() => {}).then(() => import('@atlaskit/editor-core'))
      .then((mod) => {
        if (cancelled) return;
        const Comp = (mod as any).default ?? (mod as any).Editor;
        if (!Comp) throw new Error('Editor export not found');
        setEditorComponent(() => Comp);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (loadError) {
    return <p className="text-sm text-muted-foreground italic">Failed to load editor.</p>;
  }
  if (!EditorComponent) {
    return <p className="text-sm text-muted-foreground italic">Loading editor…</p>;
  }

  return (
    <SmartCardProvider client={cardClient}>
      <div className="atlaskit-editor-wrapper rounded-md border border-input bg-background [&_.akEditor]:min-h-[160px] [&_[aria-live]]:sr-only">
        <EditorComponent
          appearance="comment"
          defaultValue={defaultValue}
          disabled={disabled}
          onEditorReady={onEditorReady}
          placeholder="Add a description…"
          allowPanel
          allowExpand
          allowRule
          allowTables
          allowDate
          allowStatus={{ menuDisabled: false }}
          allowLayouts
          allowNestedTasks
          smartLinks={{}}
        />
      </div>
    </SmartCardProvider>
  );
};

export const AtlaskitDescriptionEditor = forwardRef(AtlaskitDescriptionEditorInner);
