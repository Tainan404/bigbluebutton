import ReactPlayer from 'react-player';
import { MutationFunction } from '@apollo/client';

import { ExternalVideo } from '/imports/ui/Types/meeting';
import Dailymotion from '/imports/ui/components/external-video-player/custom-players/dailymotion';

const YOUTUBE_SHORTS_REGEX = new RegExp(/^(?:https?:\/\/)?(?:www\.)?(youtube\.com\/shorts)\/.+$/);
const YOUTUBE_REGEX = new RegExp(/^(?:https?:\/\/)?(?:www\.)?(youtube\.com|youtu.be)\/.+$/);

const startWatching = (startExternalVideoMutation: MutationFunction) => {
  return (url: string) => {
    let externalVideoUrl = url;

    if (YOUTUBE_SHORTS_REGEX.test(url)) {
      const shortsUrl = url.replace('shorts/', 'watch?v=');
      externalVideoUrl = shortsUrl;
    }

    if (YOUTUBE_REGEX.test(externalVideoUrl)) {
      const YTUrl = new URL(externalVideoUrl);
      YTUrl.searchParams.delete('list');
      YTUrl.searchParams.delete('index');
      externalVideoUrl = YTUrl.toString();
    }

    startExternalVideoMutation({ variables: { externalVideoUrl } });
  };
};

const isUrlValid = (url: string) => {
  if (!/^https.*$/.test(url)) return false;

  if (YOUTUBE_SHORTS_REGEX.test(url)) {
    const shortsUrl = url.replace('shorts/', 'watch?v=');

    return ReactPlayer.canPlay(shortsUrl);
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (['dailymotion.com', 'www.dailymotion.com', 'dai.ly'].includes(hostname)) {
    return Dailymotion.canPlay(url);
  }

  return ReactPlayer.canPlay(url);
};

// Convert state (Number) to playing (Boolean)
const getPlayingState = (state: number) => {
  if (state === 1) return true;

  return false;
};

const calculateCurrentTime = (timeSync: number, externalVideoProps?: ExternalVideo) => {
  const playerCurrentTime = externalVideoProps?.playerCurrentTime ?? 0;

  const playerUpdatedAt = externalVideoProps?.updatedAt ?? Date.now();
  const playerUpdatedAtDate = new Date(playerUpdatedAt);
  const currentDate = new Date(Date.now() + (timeSync ?? 0));
  const isPaused = !externalVideoProps?.playerPlaying;
  const currentTime = isPaused
    ? playerCurrentTime
    : ((currentDate.getTime() - playerUpdatedAtDate.getTime()) / 1000)
    + (playerCurrentTime);

  return currentTime;
};

export {
  isUrlValid,
  getPlayingState,
  calculateCurrentTime,
  startWatching,
};
