import { TypedQueryDocumentNode, DocumentNode } from 'graphql';
import { useRef, useState, useEffect } from 'react';

import { useApolloClient } from '@apollo/client';
import R from 'ramda';

function createUseSubscription<T>(
  query: DocumentNode | TypedQueryDocumentNode,
  usePatchedSubscription = false,
) {
  return function useGeneratedUseSubscription(projectionFunction: (element: Partial<T>) => void): Array<Partial<T>> {
    const client = useApolloClient();
    const [projectedData, setProjectedData] = useState<Array<T>>([]);
    const oldProjectionOfDataRef = useRef<Array<T>>([]);

    if (usePatchedSubscription) {
      // eslint-disable-next-line no-alert
      alert('Not implemented');
    }

    // TODO - manipulate query if usePatchedSubscription===true
    useEffect(() => {
      const apolloSubscription = client
        .subscribe({
          query,
        })
        .subscribe({
          next({ data }) {
          // TODO - manipulate data if usePatchedSubscription===true
          // and response data contains patch attribute
            const resultSetKey = Object.keys(data)[0];
            // console.log('resultSetKey', resultSetKey);
            const resultSet = data[resultSetKey];
            // console.log('resultSet', resultSet);

            const newProjectionOfData = resultSet.map((element: Partial<T>) => projectionFunction(element));
            if (!R.equals(oldProjectionOfDataRef.current, newProjectionOfData)) {
              oldProjectionOfDataRef.current = newProjectionOfData;
              setProjectedData(newProjectionOfData);
            }
          },
          error(err) {
            // eslint-disable-next-line no-console
            console.error('err', err);
          },
        });
      return () => apolloSubscription.unsubscribe();
    }, []);
    return projectedData;
  };
}
export default createUseSubscription;