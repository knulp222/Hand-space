import React from 'react';
import { HandPhysicsGame } from './components/HandPhysicsGame';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black">
      <HandPhysicsGame />
    </div>
  );
};

export default App;