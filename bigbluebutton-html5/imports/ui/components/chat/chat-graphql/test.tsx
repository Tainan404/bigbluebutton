import React from 'react';
import { useCurrentUser } from '/imports/ui/core/hooks/useCurrentUser';
import { User } from '/imports/ui/Types/user';

const Test: React.FC = () => {
  const a = useCurrentUser((user: Partial<User>) => {
    return {
      userId: user.userId,
      presenter: user.presenter,
    }
  });
  console.log('render', a.userId,, a.);
  return (
    <div>
      <span>{JSON.stringify(a)}</span>
    </div>
  );
};

export default Test;