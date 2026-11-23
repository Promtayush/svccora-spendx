import React from "react";
import { Navigate } from "react-router-dom";

// Legacy login file superseded by Auth.tsx
const Login: React.FC = () => {
  return <Navigate to="/auth" replace />;
};

export default Login;
