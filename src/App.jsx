import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Host from './pages/Host';
import Player from './pages/Player';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/host" element={<Host />} />
        <Route path="/play" element={<Player />} />
        <Route path="/" element={<Home />} /> {/* Use Home component for landing page */}
      </Routes>
    </Router>
  );
}

export default App;

