import React, { useContext } from 'react';
import { makeCall } from '/imports/ui/services/api';
import { withTracker } from 'meteor/react-meteor-data';
import Poll from '/imports/ui/components/poll/component';
import { Session } from 'meteor/session';
import Service from './service';
import Auth from '/imports/ui/services/auth';
import { UsersContext } from '../components-data/users-context/context';
import { layoutDispatch, layoutSelectInput } from '../layout/context';
import useMeetingSettings from '/imports/ui/core/local-states/useMeetingSettings';

const PollContainer = ({ ...props }) => {
  const [MeetingSettings] = useMeetingSettings();

  const pluginsConfig = MeetingSettings.public.poll;
  const allowCustomInput = pluginsConfig.allowCustomResponseInput;
  const maxCustomFields = pluginsConfig.maxCustom;
  const maxInputChars = pluginsConfig.maxTypedAnswerLength;

  const chatConfig = MeetingSettings.public.chat;
  const publicChatKey = chatConfig.public_id;

  const layoutContextDispatch = layoutDispatch();
  const sidebarContent = layoutSelectInput((i) => i.sidebarContent);
  const { sidebarContentPanel } = sidebarContent;

  const usingUsersContext = useContext(UsersContext);
  const { users } = usingUsersContext;

  const usernames = {};

  Object.values(users[Auth.meetingID]).forEach((user) => {
    usernames[user.userId] = { userId: user.userId, name: user.name };
  });

  return (
    <Poll
      {...{
        maxCustomFields,
        layoutContextDispatch,
        maxInputChars,
        sidebarContentPanel,
        allowCustomInput,
        publicChatKey,
        ...props,
      }}
      usernames={usernames}
    />
  );
};

export default withTracker(({ amIPresenter, currentSlideId, publicChatKey }) => {
  const isPollSecret = Session.get('secretPoll') || false;

  Meteor.subscribe('current-poll', isPollSecret, amIPresenter);

  const pollId = currentSlideId || publicChatKey;

  const { pollTypes } = Service;

  const startPoll = (type, secretPoll, question = '', isMultipleResponse) => makeCall('startPoll', pollTypes, type, pollId, secretPoll, question, isMultipleResponse);

  const startCustomPoll = (type, secretPoll, question = '', isMultipleResponse, answers) => makeCall('startPoll', pollTypes, type, pollId, secretPoll, question, isMultipleResponse, answers);

  const stopPoll = () => makeCall('stopPoll');

  return {
    isPollSecret,
    currentSlideId,
    pollTypes,
    startPoll,
    startCustomPoll,
    stopPoll,
    publishPoll: Service.publishPoll,
    currentPoll: Service.currentPoll(),
    isDefaultPoll: Service.isDefaultPoll,
    checkPollType: Service.checkPollType,
    resetPollPanel: Session.get('resetPollPanel') || false,
    pollAnswerIds: Service.pollAnswerIds,
    isMeteorConnected: Meteor.status().connected,
    validateInput: Service.validateInput,
    removeEmptyLineSpaces: Service.removeEmptyLineSpaces,
    getSplittedQuestionAndOptions: Service.getSplittedQuestionAndOptions,
  };
})(PollContainer);
