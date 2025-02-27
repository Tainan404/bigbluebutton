import { gql } from '@apollo/client';

export interface ConnectionStatusHistory {
  statusUpdatedAt: string;
  status: string;
  networkRttInMs: number;
}

export interface ConnectionStatusResponse {
  user_connectionStatusHistory: ConnectionStatusHistory[];
}

export const CONNECTION_STATUS_REPORT_SUBSCRIPTION = gql`subscription ConnStatusReport {
  user_connectionStatusReport(
  where: {
    _or: [
            { clientNotResponding: { _eq: true } }, 
            { lastUnstableStatus: { _is_null: false } }
          ]
  },
  order_by: {lastUnstableStatusAt: desc}
  ) {
    user {
      userId
      name
      avatar
      color
      isModerator
      currentlyInMeeting
    }
    clientNotResponding
    lastUnstableStatus
    lastUnstableStatusAt
    currentStatus
    connectionAliveAt
  }
}`;

export const USER_CURRENT_STATUS_SUBSCRIPTION = gql`
  subscription CurrentUserConnStatus($userId: String!) {
    user_connectionStatusReport(
      where: {
        user: {
          userId: { _eq: $userId }
        }
      }
    ) {
      currentStatus
    }
  }
`;

export const CONNECTION_STATUS_SUBSCRIPTION = gql`subscription ConnStatus {
  user_connectionStatus {
    connectionAliveAt
    userClientResponseAt
    status
    statusUpdatedAt
  }
}`;

export const CONNECTION_STATUS_HISTORY = gql`
  subscription ConnectionStatus($userId: String!) {
    user_connectionStatusHistory(order_by: {statusUpdatedAt: desc}, where: {userId: {_eq: $userId}}, limit:5) {
      statusUpdatedAt
      status
      networkRttInMs
    }
  }
`;

export default CONNECTION_STATUS_REPORT_SUBSCRIPTION;
