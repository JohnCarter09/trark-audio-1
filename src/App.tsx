import AudioRecorder from './components/AudioRecorder';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-12">
      <div className="w-full max-w-md">
        <AudioRecorder />
      </div>
    </div>
  );
}

export default App;
