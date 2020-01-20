import WhiteboardMultiUser from '/imports/api/whiteboard-multi-user/';
import Users from '/imports/api/users';
import MeteorSyncConfirmation from '/imports/startup/server/meteorSyncComfirmation';
import Logger from '/imports/startup/server/logger';

const MSG_DIRECT_TYPE = 'DIRECT';
const NODE_USER = 'nodeJSapp';


export const resyncResolver = (meetingId, dependence) => {
  if (MeteorSyncConfirmation.isSynced()) return null;
  const solved = MeteorSyncConfirmation.meetingResolve(meetingId, dependence);
  if (solved) {
    Logger.info(`${dependence} synced id=${meetingId}`);
  } else {
    Logger.info(`${dependence} not synced id=${meetingId}`);
  }

  return solved;
};


export const spokeTimeoutHandles = {};
export const clearSpokeTimeout = (meetingId, userId) => {
  if (spokeTimeoutHandles[`${meetingId}-${userId}`]) {
    Meteor.clearTimeout(spokeTimeoutHandles[`${meetingId}-${userId}`]);
    delete spokeTimeoutHandles[`${meetingId}-${userId}`];
  }
};

export const indexOf = [].indexOf || function (item) {
  for (let i = 0, l = this.length; i < l; i += 1) {
    if (i in this && this[i] === item) {
      return i;
    }
  }

  return -1;
};

export const processForHTML5ServerOnly = fn => (message, ...args) => {
  const { envelope } = message;
  const { routing } = envelope;
  const { msgType, meetingId, userId } = routing;

  const selector = {
    userId,
    meetingId,
  };

  const user = Users.findOne(selector);

  const shouldSkip = user && msgType === MSG_DIRECT_TYPE && userId !== NODE_USER && user.clientType !== 'HTML5';
  if (shouldSkip) return () => { };
  return fn(message, ...args);
};


export const getMultiUserStatus = (meetingId, whiteboardId) => {
  const data = WhiteboardMultiUser.findOne({ meetingId, whiteboardId });

  if (data) {
    return data.multiUser;
  }

  return false;
};

/**
 * Calculate a 32 bit FNV-1a hash
 * Found here: https://gist.github.com/vaiorabbit/5657561
 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
 *
 * @param {string} str the input value
 * @param {boolean} [asString=false] set to true to return the hash value as
 *     8-digit hex string instead of an integer
 * @param {integer} [seed] optionally pass the hash of the previous chunk
 * @returns {integer | string}
 */
/* eslint-disable */
export const hashFNV32a = (str, asString, seed) => {
  let hval = (seed === undefined) ? 0x811c9dc5 : seed;

  for (let i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  if (asString) {
    return (`0000000${(hval >>> 0).toString(16)}`).substr(-8);
  }
  return hval >>> 0;
};
/* eslint-enable */
