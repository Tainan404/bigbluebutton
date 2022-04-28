import _ from 'lodash';
import { diff } from '@mconf/bbb-diff';
import { Session } from 'meteor/session';
import Auth from '/imports/ui/services/auth';
import { makeCall } from '/imports/ui/services/api';
import logger from '/imports/startup/client/logger';
import Users from '/imports/api/users';
import AudioService from '/imports/ui/components/audio/service';

const THROTTLE_TIMEOUT = 1000;

const CONFIG = Meteor.settings.public.app.audioCaptions;
const ENABLED = CONFIG.enabled;
const LANGUAGES = CONFIG.language.available;

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const hasSpeechRecognitionSupport = () => typeof SpeechRecognitionAPI !== 'undefined';

const setSpeechVoices = () => {
  if (typeof window.speechSynthesis === 'undefined') return;

  Session.set('speechVoices', _.uniq(window.speechSynthesis.getVoices().map((v) => v.lang)));
};

// Trigger getVoices
setSpeechVoices();

const getSpeechVoices = () => {
  const voices = Session.get('speechVoices') || [];

  return voices.filter((v) => LANGUAGES.includes(v));
};

const setSpeechLocale = (value) => {
  const voices = getSpeechVoices();
  if (voices.includes(value) || value === '') {
    makeCall('setSpeechLocale', value);
  } else {
    logger.error({
      logCode: 'captions_speech_locale',
    }, 'Captions speech set locale error');
  }
};

const useDefault = () => ENABLED && CONFIG.language.default;

const initSpeechRecognition = () => {
  if (hasSpeechRecognitionSupport()) {
    // Effectivate getVoices
    setSpeechVoices();
    const speechRecognition = new SpeechRecognitionAPI();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;

    if (useDefault()) {
      setSpeechLocale(CONFIG.language.locale);
    } else {
      setSpeechLocale(navigator.language);
    }

    return speechRecognition;
  }

  logger.warn({
    logCode: 'captions_speech_unsupported',
  }, 'Captions speech unsupported');

  return null;
};

let prevId = '';
let prevTranscript = '';
const updateTranscript = (id, transcript, locale) => {
  // If it's a new sentence
  if (id !== prevId) {
    prevId = id;
    prevTranscript = '';
  }

  const transcriptDiff = diff(prevTranscript, transcript);

  let start = 0;
  let end = 0;
  let text = '';
  if (transcriptDiff) {
    start = transcriptDiff.start;
    end = transcriptDiff.end;
    text = transcriptDiff.text;
  }

  // Stores current transcript as previous
  prevTranscript = transcript;

  makeCall('updateTranscript', id, start, end, text, transcript, locale);
};

const throttledTranscriptUpdate = _.throttle(updateTranscript, THROTTLE_TIMEOUT, {
  leading: false,
  trailing: true,
});

const updateInterimTranscript = (id, transcript, locale) => {
  throttledTranscriptUpdate(id, transcript, locale);
};

const updateFinalTranscript = (id, transcript, locale) => {
  throttledTranscriptUpdate.cancel();
  updateTranscript(id, transcript, locale);
};

const getSpeechLocale = (userId = Auth.userID) => {
  const user = Users.findOne({ userId }, { fields: { speechLocale: 1 } });

  if (user) return user.speechLocale;

  return '';
};

const hasSpeechLocale = (userId = Auth.userID) => getSpeechLocale(userId) !== '';

const isLocaleValid = (locale) => LANGUAGES.includes(locale);

const isEnabled = () => ENABLED;

const isActive = () => isEnabled() && hasSpeechRecognitionSupport() && hasSpeechLocale();

const getStatus = () => {
  const active = isActive();
  const locale = getSpeechLocale();
  const audio = AudioService.isConnected() && !AudioService.isEchoTest() && !AudioService.isMuted();
  const connected = Meteor.status().connected && active && audio;
  const talking = AudioService.isTalking();

  return {
    locale,
    connected,
    talking,
  };
};

const generateId = () => `${Auth.userID}-${Date.now()}`;

export default {
  LANGUAGES,
  hasSpeechRecognitionSupport,
  initSpeechRecognition,
  updateInterimTranscript,
  updateFinalTranscript,
  getSpeechVoices,
  getSpeechLocale,
  setSpeechLocale,
  hasSpeechLocale,
  isLocaleValid,
  isEnabled,
  isActive,
  getStatus,
  generateId,
  useDefault,
};
