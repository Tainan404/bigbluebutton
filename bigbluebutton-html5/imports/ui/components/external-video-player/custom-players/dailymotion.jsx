import React, { Component } from 'react';
import getSDK from './get-sdk';

const MATCH_URL = /^https?:\/\/(?:(?:www\.)?dailymotion\.com\/(?:embed\/)?video\/|dai\.ly\/)([a-zA-Z0-9]+)(?:_[\w-]+)?(?:[/?#].*)?$/;
const SDK_URL = 'https://geo.dailymotion.com/libs/player.js';
const SDK_LOADED_FLAG = 'DailymotionPlayerSDK';

let playerInstanceCount = 0;

export class DailymotionPlayer extends Component {
  static displayName = 'DailymotionPlayer';

  static canPlay = url => MATCH_URL.test(url);

  constructor(props) {
    super(props);
    this.player = this;
    this._player = null;
    this.stateSnapshot = {};
    this.lastContentTime = 0;
    this.volumeBeforeMute = 1;
    this.ready = false;
    playerInstanceCount += 1;
    this.containerId = `dailymotionPlayerContainer-${playerInstanceCount}`;
  }

  componentDidMount() {
    this.props.onMount && this.props.onMount(this);
  }

  componentWillUnmount() {
    this._player?.destroy();
  }

  updateState = async () => {
    if (!this._player) return;
    const state = await this._player.getState();
    this.stateSnapshot = state;
    if (!state.adIsPlaying && Number.isFinite(state.videoTime)) this.lastContentTime = state.videoTime;
  };

  load() {
    getSDK(SDK_URL, SDK_LOADED_FLAG)
      .then(() => {
        const match = this.props.url.match(MATCH_URL);
        if (!match) return null;
        return window.dailymotion.createPlayer(this.containerId, { video: match[1], autoplay: true });
      })
      .then(async (player) => {
        if (!player) return;
        this._player = player;
        const { events } = window.dailymotion;
        player.on(events.PLAYER_CRITICALPATHREADY, () => {
          this.updateState();
          if (!this.ready) {
            this.ready = true;
            this.props.onReady();
          }
        });
        player.on(events.VIDEO_TIMECHANGE, this.updateState);
        player.on(events.VIDEO_SEEKEND, this.updateState);
        player.on(events.VIDEO_PLAY, () => this.props.onPlay());
        player.on(events.VIDEO_PAUSE, () => this.props.onPause());
        player.on(events.VIDEO_END, () => this.props.onEnded());
        player.on(events.PLAYER_ERROR, (error) => this.props.onError?.(error));
        await this.updateState();
        if (this.stateSnapshot.playerIsCriticalPathReady && !this.ready) {
          this.ready = true;
          this.props.onReady();
        }
      })
      .catch((error) => this.props.onError?.(error));
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

  getSecondsLoaded() { return 0; }

  getPlaybackRate() { return this.stateSnapshot.playerPlaybackSpeed ?? 1; }

  setPlaybackRate(rate) { this._player?.setPlaybackSpeed(rate); }

  render() {
    const style = {
      width: '100%', height: '100%', margin: 0, padding: 0, border: 0, overflow: 'hidden', backgroundColor: 'black',
    };
    return <div key={this.props.url} style={style} id={this.containerId} />;
  }
}

export default DailymotionPlayer;
