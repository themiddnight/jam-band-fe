import * as Tone from 'tone';

let userMedia: Tone.UserMedia | null = null;

export const getOrCreateUserMedia = async (): Promise<Tone.UserMedia> => {
  if (!userMedia) {
    userMedia = new Tone.UserMedia();
    // Open with raw audio (no processing)
    await userMedia.open();
  }
  return userMedia;
};

export const getUserMedia = (): Tone.UserMedia | null => {
  return userMedia;
};

export const closeUserMedia = () => {
  if (userMedia) {
    userMedia.close();
    userMedia.dispose();
    userMedia = null;
  }
};

export const isUserMediaAvailable = (): boolean => {
  return !!userMedia && userMedia.state === 'started';
};

