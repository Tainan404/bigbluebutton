import React, { Component } from 'react';
import styled from 'styled-components';
import getSDK from './get-sdk';

const MATCH_URL = /^https?:\/\/(?:(?:www\.)?dailymotion\.com\/(?:embed\/)?video\/|dai\.ly\/)([a-zA-Z0-9]+)(?:_[\w-]+)?(?:[/?#].*)?$/;
const SDK_URL = 'https://geo.dailymotion.com/libs/player.js';
const SDK_LOADED_FLAG = 'DailymotionPlayerSDK';

let playerInstanceCount = 0;

const PlayerWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: black;
  position: relative;
  container-type: size;

  > .dailymotion-player-root {
    width: 100%;
  }
`;

const SwitchControlMask = styled.span`
  position: absolute;
  z-index: 1;
  display: block;
  pointer-events: auto;
  background: black;
  opacity: 0;

  ${PlayerWrapper}:hover & {
    opacity: 1;
  }
`;

const PreviousMask = styled(SwitchControlMask)`
  top: calc(50% - 32px);
  left: calc(50% - 152px);
  width: 64px;
  height: 64px;
  border-radius: 50%;
`;

const NextMask = styled(SwitchControlMask)`
  top: calc(50% - 32px);
  left: calc(50% + 88px);
  width: 64px;
  height: 64px;
  border-radius: 50%;
`;

const MenuMask = styled(SwitchControlMask)`
  top: calc(50% - 28.125cqw + 8px);
  right: 8px;
  width: 48px;
  height: 48px;
`;

const RecommendationsMask = styled(SwitchControlMask)`
  bottom: calc(50% - 28.125cqw + 8px);
  left: 8px;
  width: 48px;
  height: 48px;
`;

export class DailymotionPlayer extends Component {
  static displayName = 'DailymotionPlayer';

  static canPlay = url => MATCH_URL.test(url);

  constructor(props) {
    super(props);
    this.player = this;
    this._player = null;
    this._destroyed = false;
    this.stateSnapshot = {};
    this.lastContentTime = 0;
    this.volumeBeforeMute = 1;
    this.ready = false;
    this.restoringPausedState = false;
    this.restoreTimeout = null;
    playerInstanceCount += 1;
    this.containerId = `dailymotionPlayerContainer-${playerInstanceCount}`;
  }

  componentDidMount() {
    this.props.onMount && this.props.onMount(this);
  }

  componentWillUnmount() {
    this._destroyed = true;
    clearTimeout(this.restoreTimeout);
    const player = this._player;
    this._player = null;
    player?.destroy();
  }

  updateState = async (eventState) => {
    if (!this._player) return;
    const player = this._player;
    try {
      const state = eventState || await player.getState();
      if (player !== this._player) return;
      this.stateSnapshot = state;
      if (!state.adIsPlaying && Number.isFinite(state.videoTime)) this.lastContentTime = state.videoTime;
    } catch (error) {
      if (player === this._player) this.props.onError?.(error);
    }
  };

  load() {
    clearTimeout(this.restoreTimeout);
    this._player?.destroy();
    this._player = null;
    this.restoringPausedState = !this.props.playing;
    getSDK(SDK_URL, SDK_LOADED_FLAG)
      .then(() => {
        if (this._destroyed) return null;
        const match = this.props.url.match(MATCH_URL);
        if (!match) return null;
        const startTime = this.props.config?.dailymotion?.startTime ?? 0;
        return window.dailymotion.createPlayer(this.containerId, {
          video: match[1],
          params: { startTime, autoplay: this.props.playing },
        });
      })
      .then(async (player) => {
        if (!player || this._destroyed) {
          player?.destroy?.();
          return;
        }
        this._player = player;
        const { events } = window.dailymotion;
        const handleReady = async () => {
          await this.updateState();
          if (this.ready || this._destroyed) return;
          this.ready = true;
          if (!this.props.playing) await player.pause();
          if (this._destroyed) return;
          this.props.onReady();
          this.restoreTimeout = setTimeout(() => {
            this.restoringPausedState = false;
          }, 1500);
        };
        player.on(events.PLAYER_CRITICALPATHREADY, () => {
          handleReady().catch((error) => this.props.onError?.(error));
        });
        player.on(events.VIDEO_TIMECHANGE, this.updateState);
        player.on(events.VIDEO_SEEKEND, this.updateState);
        const handlePlay = () => {
          if (this.restoringPausedState) {
            player.pause().finally(() => { this.restoringPausedState = false; });
            return;
          }
          this.props.onPlay();
        };
        player.on(events.VIDEO_PLAY, handlePlay);
        player.on(events.VIDEO_PLAYING, handlePlay);
        player.on(events.VIDEO_PAUSE, () => this.props.onPause());
        player.on(events.VIDEO_END, () => this.props.onEnded());
        player.on(events.PLAYER_ERROR, (error) => this.props.onError?.(error));
        await this.updateState();
        if (this.stateSnapshot.playerIsCriticalPathReady) await handleReady();
      })
      .catch((error) => {
        if (!this._destroyed) this.props.onError?.(error);
      });
  }

  play() { this._player?.play(); }

  pause() { this._player?.pause(); }

  stop() { this._player?.pause(); }

  seekTo(seconds) { this._player?.seek(seconds); }

  setVolume(volume) {
    if (volume > 0) this.volumeBeforeMute = volume;
    this._player?.setVolume(volume);
  }

  getVolume() { return this.stateSnapshot.playerVolume ?? 1; }

  mute() { this.setMuted(true); }

  unmute() { this.setMuted(false); }

  setMuted(muted) {
    if (muted) {
      const currentVolume = this.getVolume();
      if (currentVolume > 0) this.volumeBeforeMute = currentVolume;
    }
    this._player?.setMute(muted);
    if (!muted && this.getVolume() === 0) this._player?.setVolume(this.volumeBeforeMute || 1);
  }

  isMuted() { return this.stateSnapshot.playerIsMuted ?? (this.getVolume() === 0); }

  getDuration() { return this.stateSnapshot.videoDuration ?? 0; }

  getCurrentTime() {
    return this.stateSnapshot.adIsPlaying ? this.lastContentTime : (this.stateSnapshot.videoTime ?? 0);
  }

  getSecondsLoaded() {
    const duration = this.getDuration();
    const bufferedTime = this.stateSnapshot.videoBufferedTime
      ?? this.stateSnapshot.videoBuffered
      ?? this.stateSnapshot.bufferedTime;
    if (Number.isFinite(bufferedTime)) return Math.min(duration, bufferedTime);

    // The current SDK does not document buffered ranges in getState(). The current
    // playback position is the conservative lower bound of content already loaded.
    return Math.min(duration, this.getCurrentTime());
  }

  getPlaybackRate() { return this.stateSnapshot.playerPlaybackSpeed ?? 1; }

  setPlaybackRate(rate) { this._player?.setPlaybackSpeed(rate); }

  render() {
    const isPresenter = this.props.previewTabIndex === 0;
    return (
      <PlayerWrapper>
        <div key={this.props.url} id={this.containerId} />
        {isPresenter && (
          <>
            <PreviousMask data-test="dailymotionPreviousMask" />
            <NextMask data-test="dailymotionNextMask" />
            <MenuMask data-test="dailymotionMenuMask" />
            <RecommendationsMask data-test="dailymotionRecommendationsMask" />
          </>
        )}
      </PlayerWrapper>
    );
  }
}

export default DailymotionPlayer;
