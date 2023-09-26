import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSubscription } from '@apollo/client';
import { defineMessages, useIntl } from 'react-intl';
import { useMeeting } from '/imports/ui/core/hooks/useMeeting';
import { notify } from '/imports/ui/services/notification';

import {
  GET_GUEST_WAITING_USERS_SUBSCRIPTION,
  GuestWaitingUser,
  GuestWaitingUsers,
} from './queries';
import { layoutDispatch } from '../../layout/context';
import { ACTIONS, PANELS } from '../../layout/enums';
import Styled from './styles';
import {
  guestUsersCall,
  privateMessageVisible,
  setGuestLobbyMessage,
  setPrivateGuestLobbyMessage,
  changeGuestPolicy,
} from './service';
import browserInfo from '/imports/utils/browserInfo';
import Header from '/imports/ui/components/common/control-header/component';
import TextInput from '/imports/ui/components/text-input/component';
import renderNoUserWaitingItem from './guest-items/noPendingGuestUser';
import renderPendingUsers from './guest-items/guestPendingUser';
import { Meeting } from '/imports/ui/Types/meeting';

// @ts-ignore - temporary, while meteor exists in the project
const isGuestLobbyMessageEnabled = Meteor.settings.public.app.enableGuestLobbyMessage;
// @ts-ignore - temporary, while meteor exists in the project
const { guestPolicyExtraAllowOptions } = Meteor.settings.public.app;

// We use the dynamicGuestPolicy rule for allowing the rememberChoice checkbox
// @ts-ignore - temporary, while meteor exists in the project
const allowRememberChoice = Meteor.settings.public.app.dynamicGuestPolicy;

interface LayoutDispatchProps {
  type: string,
  value: boolean | string,
}

interface GuestUsersManagementPanelProps {
  authedGuestUsers: GuestWaitingUser[];
  unauthedGuestUsers: GuestWaitingUser[];
  guestLobbyMessage: string | null;
  guestLobbyEnabled: boolean;
  layoutContextDispatch: (action: LayoutDispatchProps) => void;
}

type SeparatedUsers = {
  authed: GuestWaitingUser[];
  unauthed: GuestWaitingUser[];
};

type ButtonProps = {
  key: string;
  color: string;
  policy: string;
  action: ()=> void;
  dataTest: string;
};

type ButtonData = {
  messageId: {
    id: string;
    description: string;
  },
  action: () => void,
  key: string,
  color: string,
  policy: string,
  dataTest: string,
}

const ALLOW_STATUS = 'ALLOW';
const DENY_STATUS = 'DENY';

const intlMessages = defineMessages({
  waitingUsersTitle: {
    id: 'app.userList.guest.waitingUsersTitle',
    description: 'Title for the notes list',
  },
  title: {
    id: 'app.userList.guest.waitingUsers',
    description: 'Label for the waiting users',
  },
  optionTitle: {
    id: 'app.userList.guest.optionTitle',
    description: 'Label above the options',
  },
  allowAllAuthenticated: {
    id: 'app.userList.guest.allowAllAuthenticated',
    description: 'Title for the waiting users',
  },
  allowAllGuests: {
    id: 'app.userList.guest.allowAllGuests',
    description: 'Title for the waiting users',
  },
  allowEveryone: {
    id: 'app.userList.guest.allowEveryone',
    description: 'Title for the waiting users',
  },
  denyEveryone: {
    id: 'app.userList.guest.denyEveryone',
    description: 'Title for the waiting users',
  },
  pendingUsers: {
    id: 'app.userList.guest.pendingUsers',
    description: 'Title for the waiting users',
  },
  pendingGuestUsers: {
    id: 'app.userList.guest.pendingGuestUsers',
    description: 'Title for the waiting users',
  },
  noPendingUsers: {
    id: 'app.userList.guest.noPendingUsers',
    description: 'Label for no users waiting',
  },
  rememberChoice: {
    id: 'app.userList.guest.rememberChoice',
    description: 'Remember label for checkbox',
  },
  emptyMessage: {
    id: 'app.userList.guest.emptyMessage',
    description: 'Empty guest lobby message label',
  },
  inputPlaceholder: {
    id: 'app.userList.guest.inputPlaceholder',
    description: 'Placeholder to guest lobby message input',
  },
  privateMessageLabel: {
    id: 'app.userList.guest.privateMessageLabel',
    description: 'Private message button label',
  },
  privateInputPlaceholder: {
    id: 'app.userList.guest.privateInputPlaceholder',
    description: 'Private input placeholder',
  },
  accept: {
    id: 'app.userList.guest.acceptLabel',
    description: 'Accept guest button label',
  },
  deny: {
    id: 'app.userList.guest.denyLabel',
    description: 'Deny guest button label',
  },
  feedbackMessage: {
    id: 'app.userList.guest.feedbackMessage',
    description: 'Feedback message moderator action',
  },
});

const GuestUsersManagementPanel: React.FC<GuestUsersManagementPanelProps> = ({
  authedGuestUsers,
  unauthedGuestUsers,
  layoutContextDispatch,
  guestLobbyEnabled,
  guestLobbyMessage,
}) => {
  const intl = useIntl();
  const { isChrome } = browserInfo;
  const [rememberChoice, setRememberChoice] = useState(false);

  const existPendingUsers = authedGuestUsers.length > 0 || unauthedGuestUsers.length > 0;

  const closePanel = useCallback(() => {
    layoutContextDispatch({
      type: ACTIONS.SET_SIDEBAR_CONTENT_IS_OPEN,
      value: false,
    });
    layoutContextDispatch({
      type: ACTIONS.SET_SIDEBAR_CONTENT_PANEL,
      value: PANELS.NONE,
    });
  }, []);

  const onCheckBoxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setRememberChoice(checked);
  }, []);

  const getPrivateGuestLobbyMessage = useCallback((userId: string) => {
    const user = authedGuestUsers
      .concat(unauthedGuestUsers)
      .find((u: GuestWaitingUser) => u.user.userId === userId);
    if (!user) return '';
    return user.guestLobbyMessage;
  }, [authedGuestUsers, unauthedGuestUsers]);

  const changePolicy = useCallback((
    shouldExecutePolicy: boolean,
    policyRule: string,
    cb: ()=> void,
    message: string,
  ) => () => {
    if (shouldExecutePolicy) {
      changeGuestPolicy(policyRule);
    }

    closePanel();

    notify(intl.formatMessage(intlMessages.feedbackMessage) + message.toUpperCase(), 'success');

    return cb();
  }, []);

  const renderButton = useCallback((message: string,
    {
      key,
      color,
      policy,
      action,
      dataTest,
    }: ButtonProps) => (
      <Styled.CustomButton
        key={key}
        color={color}
        label={message}
        size="lg"
        onClick={changePolicy(rememberChoice, policy, action, message)}
        data-test={dataTest}
      />
  ), [rememberChoice]);

  useEffect(() => {
    if (!guestLobbyEnabled) {
      closePanel();
    }
  }, [guestLobbyEnabled]);

  const authGuestButtonsData = useMemo(() => [
    {
      messageId: intlMessages.allowAllAuthenticated,
      action: () => guestUsersCall(authedGuestUsers, ALLOW_STATUS),
      key: 'allow-all-auth',
      color: 'primary',
      policy: 'ALWAYS_ACCEPT_AUTH',
      dataTest: 'allowAllAuthenticated',
    },
    {
      messageId: intlMessages.allowAllGuests,
      action: () => guestUsersCall(
        [...unauthedGuestUsers].concat(rememberChoice ? authedGuestUsers : []),
        ALLOW_STATUS,
      ),
      key: 'allow-all-guest',
      color: 'primary',
      policy: 'ALWAYS_ACCEPT',
      dataTest: 'allowAllGuests',
    },
  ], [authedGuestUsers, unauthedGuestUsers, rememberChoice]);

  const guestButtonsData = useMemo(() => [
    {
      messageId: intlMessages.allowEveryone,
      action: () => guestUsersCall([...unauthedGuestUsers, ...authedGuestUsers], ALLOW_STATUS),
      key: 'allow-everyone',
      color: 'primary',
      policy: 'ALWAYS_ACCEPT',
      dataTest: 'allowEveryone',
    },
    {
      messageId: intlMessages.denyEveryone,
      action: () => guestUsersCall([...unauthedGuestUsers, ...authedGuestUsers], DENY_STATUS),
      key: 'deny-everyone',
      color: 'danger',
      policy: 'ALWAYS_DENY',
      dataTest: 'denyEveryone',
    },
  ], [unauthedGuestUsers, authedGuestUsers]);

  const buttonsData = (authedGuestUsers && guestPolicyExtraAllowOptions)
    ? authGuestButtonsData.concat(guestButtonsData)
    : guestButtonsData;

  return (
    <Styled.Panel data-test="note" isChrome={isChrome}>
      <Header
        leftButtonProps={{
          onClick: () => closePanel(),
          label: intl.formatMessage(intlMessages.title),
        }}
        rightButtonProps={null}
        data-test="guestUsersManagementPanel"
        customRightButton={null}
        x="guestUsersManagementPanel"
      />
      <Styled.ScrollableArea>
        {isGuestLobbyMessageEnabled ? (
          <Styled.LobbyMessage data-test="lobbyMessage">
            <TextInput
              maxLength={128}
              placeholder={intl.formatMessage(intlMessages.inputPlaceholder)}
              send={setGuestLobbyMessage}
            />
            <p>
              <i>
                &quot;
                {
                  guestLobbyMessage && guestLobbyMessage !== ''
                    ? guestLobbyMessage
                    : intl.formatMessage(intlMessages.emptyMessage)
                }
                &quot;
              </i>
            </p>
          </Styled.LobbyMessage>
        ) : null}
        <Styled.ModeratorActions>
          <Styled.MainTitle>{intl.formatMessage(intlMessages.optionTitle)}</Styled.MainTitle>
          {
            buttonsData.map((btData: ButtonData) => renderButton(
              intl.formatMessage(btData.messageId),
              btData,
            ))
          }
          {allowRememberChoice ? (
            <Styled.RememberContainer>
              <input id="rememberCheckboxId" type="checkbox" onChange={onCheckBoxChange} />
              <label htmlFor="rememberCheckboxId">
                {intl.formatMessage(intlMessages.rememberChoice)}
              </label>
            </Styled.RememberContainer>
          ) : null}
        </Styled.ModeratorActions>
        {renderPendingUsers(
          intl.formatMessage(intlMessages.pendingUsers,
            { 0: authedGuestUsers.length }),
          authedGuestUsers,
          guestUsersCall,
          privateMessageVisible,
          setPrivateGuestLobbyMessage,
          getPrivateGuestLobbyMessage,
          isGuestLobbyMessageEnabled,
        )}
        {renderPendingUsers(
          intl.formatMessage(intlMessages.pendingGuestUsers,
            { 0: unauthedGuestUsers.length }),
          unauthedGuestUsers,
          guestUsersCall,
          privateMessageVisible,
          setPrivateGuestLobbyMessage,
          getPrivateGuestLobbyMessage,
          isGuestLobbyMessageEnabled,
        )}
        {!existPendingUsers && (
          renderNoUserWaitingItem(intl.formatMessage(intlMessages.noPendingUsers))
        )}
      </Styled.ScrollableArea>
    </Styled.Panel>
  );
};

const GuestUsersManagementPanelContainer: React.FC = () => {
  const layoutContextDispatch = layoutDispatch();

  const {
    data: guestWaitingUsersData,
    loading: guestWaitingUsersLoading,
    error: guestWaitingUsersError,
  } = useSubscription<GuestWaitingUsers>(GET_GUEST_WAITING_USERS_SUBSCRIPTION);

  const currentMeeting: Partial<Meeting> = useMeeting((meeting) => {
    const a = {
      usersPolicies: meeting.usersPolicies,
    };

    return a;
  });

  if (guestWaitingUsersLoading || !currentMeeting) {
    return null;
  }

  if (guestWaitingUsersError) {
    if (guestWaitingUsersError) console.log('guestWaitingUsersError', guestWaitingUsersError);
    return (
      <div>
        {guestWaitingUsersError && <p>{JSON.stringify(guestWaitingUsersError)}</p>}
      </div>
    );
  }

  const separateGuestUsersByAuthed = guestWaitingUsersData
    ?.user_guest
    ?.reduce((acc: SeparatedUsers, user: GuestWaitingUser) => {
      if (user.user.authed) {
        acc.authed.push(user);
      } else {
        acc.unauthed.push(user);
      }
      return acc;
    }, { authed: [], unauthed: [] }) ?? { authed: [], unauthed: [] };

  return (
    <GuestUsersManagementPanel
      authedGuestUsers={separateGuestUsersByAuthed.authed}
      unauthedGuestUsers={separateGuestUsersByAuthed.unauthed}
      guestLobbyMessage={currentMeeting?.usersPolicies?.guestLobbyMessage ?? null}
      guestLobbyEnabled={(currentMeeting?.usersPolicies?.guestPolicy === 'ASK_MODERATOR')
      || !!(guestWaitingUsersData?.user_guest?.length)}
      layoutContextDispatch={layoutContextDispatch}
    />
  );
};

export default GuestUsersManagementPanelContainer;
