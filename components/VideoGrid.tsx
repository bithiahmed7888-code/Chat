import React, { useEffect, useRef } from 'react';
import { PeerState } from '../types';
import { MicOff, VideoOff, User } from 'lucide-react';

interface VideoGridProps {
  localStream: MediaStream | null;
  remotePeers: PeerState[];
  isLocalMuted: boolean;
  isLocalVideoOff: boolean;
}

const VideoCard: React.FC<{ stream: MediaStream | null; muted?: boolean; isLocal?: boolean; label?: string }> = ({
  stream,
  muted,
  isLocal,
  label
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideoTrack = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;

  return (
    <div className="relative w-full h-full bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
      {hasVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted} 
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
            <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center">
                <User className="w-12 h-12 text-slate-400" />
            </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
        <span className="text-white text-sm font-medium flex items-center gap-2">
          {label || (isLocal ? 'You' : 'Friend')}
          {isLocal && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
        </span>
      </div>

        {/* Status Indicators */}
        <div className="absolute top-4 right-4 flex gap-2">
             {(!hasVideoTrack) && (
                <div className="p-2 bg-red-500/80 rounded-full backdrop-blur-sm">
                    <VideoOff className="w-4 h-4 text-white" />
                </div>
            )}
            {/* Note: We can't easily detect remote mute state via MediaStream tracks in all browsers accurately without signaling, 
                but if the track is disabled locally, it stops sending. */}
        </div>
    </div>
  );
};

const VideoGrid: React.FC<VideoGridProps> = ({ localStream, remotePeers, isLocalMuted, isLocalVideoOff }) => {
  return (
    <div className={`grid gap-4 h-full p-4 ${remotePeers.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
      <div className="relative min-h-[300px]">
        {/* Override stream tracks enabled state visually if local state says off, 
            though the track.enabled toggle handles the actual stream data */}
        <VideoCard 
            stream={localStream} 
            muted={true} 
            isLocal={true} 
            label="You"
        />
      </div>
      {remotePeers.map((peer) => (
        <div key={peer.peerId} className="relative min-h-[300px]">
          <VideoCard stream={peer.stream || null} isLocal={false} label={`Peer ${peer.peerId.substring(0,4)}`} />
        </div>
      ))}
    </div>
  );
};

export default VideoGrid;
