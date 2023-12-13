import React from 'react';
import { useSubscription } from '@apollo/client';
import SettingsService from '/imports/ui/services/settings';
import Cursors from './component';
import Service from './service';
import { CURSOR_SUBSCRIPTION } from './queries';
import { omit } from 'radash';
import useMeetingSettings from '/imports/ui/core/local-states/useMeetingSettings';

const CursorsContainer = (props) => {
  const [MeetingSettings] = useMeetingSettings();
  const baseName = MeetingSettings.public.app.cdn + MeetingSettings.public.app.basename;
  const makeCursorUrl = (filename) => `${baseName}/resources/images/whiteboard-cursor/${filename}`;
  const { data: cursorData } = useSubscription(CURSOR_SUBSCRIPTION);
  const { pres_page_cursor: cursorArray } = (cursorData || []);

  if (!cursorData) return null;

  return (
    <Cursors
      {...{
        application: SettingsService?.application,
        publishCursorUpdate: Service.publishCursorUpdate,
        otherCursors: cursorArray,
        currentPoint: props.tldrawAPI?.currentPoint,
        tldrawCamera: props.tldrawAPI?.getPageState().camera,
        makeCursorUrl,
      }}
      {...omit(props, ['tldrawAPI'])}
    />
  )
};

export default CursorsContainer;