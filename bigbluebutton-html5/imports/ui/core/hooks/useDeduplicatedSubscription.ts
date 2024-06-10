import { useEffect, useMemo, useRef } from 'react';
import GrahqlSubscriptionStore, { stringToHash } from '/imports/ui/core/singletons/subscriptionStore';
import { DocumentNode, TypedQueryDocumentNode } from 'graphql';
import { OperationVariables, SubscriptionHookOptions, useReactiveVar } from '@apollo/client';
// same as useSubscription type
//  eslint-disable-next-line @typescript-eslint/no-explicit-any
const useDeduplicatedSubscription = <T = any>(
  subscription: DocumentNode | TypedQueryDocumentNode,
  options?: SubscriptionHookOptions<NoInfer<T>, NoInfer<OperationVariables>>,
) => {
  const subscriptionHashRef = useRef<string>('');
  const subscriptionRef = useRef <DocumentNode | TypedQueryDocumentNode | null>(null);
  const optionsRef = useRef(options);
  const subscriptionHash = stringToHash(JSON.stringify({ subscription, variables: options?.variables }));

  useEffect(() => {
    return () => {
      GrahqlSubscriptionStore.unsubscribe(subscription, options?.variables);
    };
  }, []);

  useEffect(() => {
    if (subscriptionHashRef.current !== subscriptionHash) {
      subscriptionHashRef.current = subscriptionHash;
      if (subscriptionRef.current && optionsRef.current) {
        GrahqlSubscriptionStore.unsubscribe(subscriptionRef.current, optionsRef.current?.variables);
      }

      subscriptionRef.current = subscription;
      optionsRef.current = options;
    }
  }, [subscriptionHash]);

  const sub = useMemo(() => {
    return GrahqlSubscriptionStore.makeSubscription<T>(subscription, options?.variables);
  }, [subscriptionHash]);
  return useReactiveVar(sub);
};

export default useDeduplicatedSubscription;
