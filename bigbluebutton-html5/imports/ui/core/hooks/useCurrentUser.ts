import { useMemo } from 'react';
import { User } from '../../Types/user';
import createUseSubscription from './createUseSubscription';
import CURRENT_USER_SUBSCRIPTION from '../graphql/queries/currentUserSubscription';

const currentUserSubscription = createUseSubscription<User>(CURRENT_USER_SUBSCRIPTION, {}, true);
const useCurrentUser = (fn: (c: Partial<User>) => Partial<User> = (u) => u) => {
  const response = currentUserSubscription(fn);
  console.log("🚀 -> response:", response)
  const returnObject = useMemo(() => {
    console.log("🚀 -> returnObject -> response.data:", response.data)
    return {
      ...response,
      data: response.data ? response.data[0] : null,
      rawData: response.data ?? null,
    };
  }, [response]);
  console.log("🚀 -> returnObject -> returnObject:", returnObject);
  return returnObject;
};

export default useCurrentUser;
