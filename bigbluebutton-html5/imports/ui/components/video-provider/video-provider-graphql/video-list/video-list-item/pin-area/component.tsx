import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import VideoService from '/imports/ui/components/video-provider/video-provider-graphql/service';
import { useMutation } from '@apollo/client';
import Styled from './styles';
import { SET_CAMERA_PINNED } from '/imports/ui/core/graphql/mutations/userMutations';
import { VideoItem } from '../../../types';

const intlMessages = defineMessages({
  unpinLabel: {
    id: 'app.videoDock.webcamUnpinLabel',
  },
  unpinLabelDisabled: {
    id: 'app.videoDock.webcamUnpinLabelDisabled',
  },
});

interface PinAreaProps {
  stream: VideoItem;
  amIModerator: boolean;
}

const PinArea: React.FC<PinAreaProps> = (props) => {
  const intl = useIntl();

  const { stream, amIModerator } = props;
  const { userId, type } = stream;
  const pinned = type === 'stream' && stream.pinned;
  const videoPinActionAvailable = VideoService.isVideoPinEnabledForCurrentUser(amIModerator);

  const [setCameraPinned] = useMutation(SET_CAMERA_PINNED);

  if (!pinned) return <Styled.PinButtonWrapper />;

  return (
    <Styled.PinButtonWrapper>
      <Styled.PinButton
        color="default"
        icon={!pinned ? 'pin-video_on' : 'pin-video_off'}
        size="sm"
        onClick={() => {
          setCameraPinned({
            variables: {
              userId,
              pinned: false,
            },
          });
        }}
        label={videoPinActionAvailable
          ? intl.formatMessage(intlMessages.unpinLabel)
          : intl.formatMessage(intlMessages.unpinLabelDisabled)}
        hideLabel
        disabled={!videoPinActionAvailable}
        data-test="pinVideoButton"
      />
    </Styled.PinButtonWrapper>
  );
};

export default PinArea;
