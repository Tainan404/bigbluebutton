import React from 'react';
import ListOfOcurrencesContainer from './listOfOcurrences';

interface UserConnectionMetricsContainerProps {
  userId: string;
}

const UserConnectionMetrics: React.FC<UserConnectionMetricsContainerProps> = ({ userId}) => {
  return (
    <div>
      <ListOfOcurrencesContainer userId={userId} />
    </div>
  );
};

const UserConnectionMetricsContainer: React.FC<UserConnectionMetricsContainerProps> = ({
  userId,
}) => {
  return (
    <UserConnectionMetrics
      userId={userId}
    />
  );
};

export default UserConnectionMetricsContainer;
