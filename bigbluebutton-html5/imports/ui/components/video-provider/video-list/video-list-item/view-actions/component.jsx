import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { ACTIONS } from '/imports/ui/components/layout/enums';
import FullscreenButtonContainer from '/imports/ui/components/common/fullscreen-button/container';
import Styled from './styles';
import useMeetingSettings from '/imports/ui/core/local-states/useMeetingSettings';

const ViewActions = (props) => {
  const {
    name, cameraId, videoContainer, isFullscreenContext, layoutContextDispatch, isStream,
  } = props;

  const [MeetingSettings] = useMeetingSettings();
  const appConfig = MeetingSettings.public.app;
  const { allowFullscreen } = appConfig;

  useEffect(() => () => {
    // exit fullscreen when component is unmounted
    if (isFullscreenContext) {
      layoutContextDispatch({
        type: ACTIONS.SET_FULLSCREEN_ELEMENT,
        value: {
          element: '',
          group: '',
        },
      });
    }
  }, []);

  if (!allowFullscreen || !isStream) return null;

  return (
    <Styled.FullscreenWrapper>
      <FullscreenButtonContainer
        data-test="webcamsFullscreenButton"
        fullscreenRef={videoContainer.current}
        elementName={name}
        elementId={cameraId}
        elementGroup="webcams"
        isFullscreen={isFullscreenContext}
        dark
      />
    </Styled.FullscreenWrapper>
  );
};

export default ViewActions;

ViewActions.propTypes = {
  name: PropTypes.string.isRequired,
  cameraId: PropTypes.string.isRequired,
  videoContainer: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]).isRequired,
  isFullscreenContext: PropTypes.bool.isRequired,
  layoutContextDispatch: PropTypes.func.isRequired,
};
