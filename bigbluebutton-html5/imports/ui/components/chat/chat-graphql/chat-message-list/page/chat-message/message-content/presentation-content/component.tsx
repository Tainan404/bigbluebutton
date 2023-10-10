import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import Styled from './styles';

interface ChatMessagePresentationContentProps {
  metadata: string;
}
interface Metadata {
  fileURI: string;
  filename: string;
}

function assertAsMetadata(metadata: unknown): asserts metadata is Metadata {
  if (typeof metadata !== 'object' || metadata === null) {
    throw new Error('metadata is not an object');
  }
  if (typeof (metadata as Metadata).fileURI !== 'string') {
    throw new Error('metadata.fileURI is not a string');
  }
  if (typeof (metadata as Metadata).filename !== 'string') {
    throw new Error('metadata.fileName is not a string');
  }
}

const intlMessages = defineMessages({
  download: {
    id: 'app.presentation.downloadLabel',
    description: 'used as label for presentation download link',
  },
  notAccessibleWarning: {
    id: 'app.presentationUploader.export.notAccessibleWarning',
    description: 'used for indicating that a link may be not accessible',
  },
});

const ChatMessagePresentationContent: React.FC<ChatMessagePresentationContentProps> = ({
  metadata: string,
}) => {
  const intl = useIntl();
  const presentationData = JSON.parse(string) as unknown;
  assertAsMetadata(presentationData);
  return (
    <Styled.ChatDowloadContainer data-test="downloadPresentationContainer">
      <span>{presentationData.filename}</span>
      <Styled.ChatLink
        href={presentationData.fileURI}
        aria-label={intl.formatMessage(intlMessages.notAccessibleWarning)}
        type="application/pdf"
        rel="noopener, noreferrer"
        download
      >
        {intl.formatMessage(intlMessages.download)}
        <i className="icon-bbb-warning" />
      </Styled.ChatLink>
    </Styled.ChatDowloadContainer>
  );
};

export default ChatMessagePresentationContent;
