export interface MediaItem { id: string; type: 'video' | 'image'; src: string; aspect: number; caption: string; poster?: string }
export const mediaItems: MediaItem[];
