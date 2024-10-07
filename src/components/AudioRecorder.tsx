import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  Square,
  Pause,
  RotateCcw,
  Play,
  Edit2,
  Check,
  Download,
} from 'lucide-react';

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/wav',
        });
        setAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      visualize(stream);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const visualize = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'rgb(255, 255, 255)';
      canvasCtx.fillRect(0, 0, width, height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
      canvasCtx.beginPath();

      const sliceWidth = (width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const resetRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setTranscribedText('');
    setAudioBlob(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (audioRef.current) {
      audioRef.current.src = '';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');

      const response = await fetch(
        'https://api.openai.com/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTranscribedText(data.text);
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscribedText('Error transcribing audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const downloadTranscription = () => {
    if (!transcribedText) return;

    const element = document.createElement('a');
    const file = new Blob([transcribedText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'transcription.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-lg">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold mb-2">Trakr Audio Transcriber</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your go-to speech-to-text note taker Powered by OpenAI
          </p>
        </div>

        <div className="mb-6">
          <canvas
            ref={canvasRef}
            width="320"
            height="80"
            className="w-full bg-accent rounded"
          ></canvas>
        </div>

        <div className="flex justify-center items-center mb-6">
          <div className="text-4xl font-mono">{formatTime(duration)}</div>
        </div>

        <div className="flex justify-center space-x-4 mb-6">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Mic className="mr-2 h-4 w-4" /> Record
            </Button>
          ) : isPaused ? (
            <Button
              onClick={resumeRecording}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Play className="mr-2 h-4 w-4" /> Resume
            </Button>
          ) : (
            <Button
              onClick={pauseRecording}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          )}

          <Button
            onClick={stopRecording}
            disabled={!isRecording}
            variant="outline"
          >
            <Square className="mr-2 h-4 w-4" /> Stop
          </Button>

          <Button onClick={resetRecording} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
        </div>

        {isRecording && !isPaused && (
          <div className="mt-4 text-center text-sm text-destructive animate-pulse">
            Recording in progress...
          </div>
        )}

        {audioBlob && (
          <div className="mt-4">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              controlsList="nodownload"
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {audioBlob && !transcribedText && (
          <Button
            onClick={transcribeAudio}
            className="w-full mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={isTranscribing}
          >
            {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
          </Button>
        )}

        {transcribedText && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Transcribed Text</h3>
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary/90"
              >
                {isEditing ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Edit2 className="h-4 w-4" />
                )}
              </Button>
            </div>
            {isEditing ? (
              <Textarea
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                className="w-full min-h-[100px]"
              />
            ) : (
              <p className="text-sm text-foreground bg-accent p-3 rounded">
                {transcribedText}
              </p>
            )}
          </div>
        )}

        {transcribedText && (
          <Button
            onClick={downloadTranscription}
            className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-4 w-4" /> Download Transcription
          </Button>
        )}
      </div>
    </div>
  );
}
