import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Curious Cat</h1>
      <div className="space-y-4">
        <Link
          to="/host"
          className="block w-64 p-4 text-center bg-purple-600 rounded-lg hover:bg-purple-700 transition"
        >
          DESKTOP
        </Link>
        <Link
          to="/play"
          className="block w-64 p-4 text-center bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          MOBILE
        </Link>
      </div>
    </div>
  );
}

export default Home;



