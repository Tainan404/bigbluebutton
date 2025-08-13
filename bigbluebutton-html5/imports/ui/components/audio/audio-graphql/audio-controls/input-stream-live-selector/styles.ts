/* eslint-disable @typescript-eslint/ban-ts-comment */
import styled from 'styled-components';
import ButtonEmoji from '/imports/ui/components/common/button/button-emoji/ButtonEmoji';
import {
  colorPrimary,
  colorDanger,
  colorGrayDark,
  colorOffWhite,
  colorSuccess,
} from '/imports/ui/stylesheets/styled-components/palette';
import { css } from "@linaria/core";

// Create a reusable CSS class
const pulseClass = css`
  @keyframes pulseShadow {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, .7); }
    70% { box-shadow: 0 0 0 0.75rem rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }

  animation: pulseShadow 1.5s ease-in-out infinite;
  border-radius: 9999px;
`;


export const DisabledLabel = {
  color: colorGrayDark,
  fontWeight: 'bold',
  opacity: 1,
  fontSize: '1rem',
};

export const AudioSettingsOption = {
  paddingLeft: 12,
};

export const SelectedLabel = {
  color: colorPrimary,
  backgroundColor: colorOffWhite,
  fontWeight: 'bold',
  paddingLeft: '2.6rem',
};

export const DeviceLabel = {
  paddingLeft: '2.6rem',
};

export const SelectedLabelIcon = {
  color: colorSuccess,
  fontSize: '1.2rem',
};

export const DangerColor = {
  color: colorDanger,
  paddingLeft: 12,
};

// @ts-ignore - as button comes from JS, we can't provide its props
export const AudioDropdown = styled(ButtonEmoji)`
  span {
    i {
      width: 10px !important;
      bottom: 1px;
    }
  }
`;

export default {
  DisabledLabel,
  DeviceLabel,
  SelectedLabel,
  SelectedLabelIcon,
  AudioSettingsOption,
  DangerColor,
  AudioDropdown,
  pulseClass,
};
