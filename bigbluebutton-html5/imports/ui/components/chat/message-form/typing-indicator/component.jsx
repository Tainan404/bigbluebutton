import React, { PureComponent } from 'react';
import {
  defineMessages, injectIntl, FormattedMessage,
} from 'react-intl';
import PropTypes from 'prop-types';
import Styled from './styles';

const propTypes = {
  intl: PropTypes.object.isRequired,
  typingUsers: PropTypes.arrayOf(Object).isRequired,
};

const messages = defineMessages({
  severalPeople: {
    id: 'app.chat.multi.typing',
    description: 'displayed when 4 or more users are typing',
  },
});

class TypingIndicator extends PureComponent {
  constructor(props) {
    super(props);

    this.renderTypingElement = this.renderTypingElement.bind(this);
  }

  renderTypingElement() {
    const {
      typingUsers, indicatorEnabled, intl,
    } = this.props;

    if (!indicatorEnabled || !typingUsers) return null;

    const { length } = typingUsers;
    const isSingleTyper = length === 1;
    const isCoupleTyper = length === 2;
    const isMuiltiTypers = length > 2;

    let element = null;

    if (isSingleTyper) {
      const { name } = typingUsers[0];
      element = (
        <FormattedMessage
          id="app.chat.one.typing"
          description="label used when one user is typing"
          values={{
            0: <Styled.SingleTyper
              dangerouslySetInnerHTML={{ __html: `${name} &nbsp;` }}
            />,
          }}
        />
      );
    }

    if (isCoupleTyper) {
      const { name } = typingUsers[0];
      const { name: name2 } = typingUsers[1];
      element = (
        <FormattedMessage
          id="app.chat.two.typing"
          description="label used when two users are typing"
          values={{
            0: <Styled.CoupleTyper dangerouslySetInnerHTML={{ __html: `${name} &nbsp;` }} />,
            1: <Styled.CoupleTyper dangerouslySetInnerHTML={{ __html: `${name2} &nbsp;` }} />,
          }}
        />
      );
    }

    if (isMuiltiTypers) {
      element = (
        <span>
          {`${intl.formatMessage(messages.severalPeople)}`}
        </span>
      );
    }

    return element;
  }

  render() {
    const {
      error,
      indicatorEnabled,
    } = this.props;

    const typingElement = indicatorEnabled ? this.renderTypingElement() : null;

    return (
      <Styled.TypingIndicatorWrapper
        error={!!error}
        info={!error}
        spacer={!!typingElement}
      >
        <Styled.TypingIndicator data-test="typingIndicator">{error || typingElement}</Styled.TypingIndicator>
      </Styled.TypingIndicatorWrapper>
    );
  }
}

TypingIndicator.propTypes = propTypes;

export default injectIntl(TypingIndicator);
