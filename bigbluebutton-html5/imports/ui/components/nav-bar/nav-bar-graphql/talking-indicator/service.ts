import { debounce } from 'radash';
import { makeCall } from '/imports/ui/services/api';

const TALKING_INDICATOR_MUTE_INTERVAL = 500;

export const muteUser = debounce(
  { delay: TALKING_INDICATOR_MUTE_INTERVAL },
  (id: string, muted: boolean | undefined, isBreakout: boolean, isModerator: boolean) => {
    if (!isModerator || isBreakout || muted) return null;
    makeCall('toggleVoice', id);
    return null;
  },
);

export default {
  muteUser,
};
