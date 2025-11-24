import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function Home() {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    setRoute(isMobile ? "/play" : "/host");
  }, []);

  // while deciding route, show nothing (or a loader)
  if (!route) return null;

  return <Navigate to={route} replace />;
}
