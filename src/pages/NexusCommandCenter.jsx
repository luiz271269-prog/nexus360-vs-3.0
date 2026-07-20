import React from "react";
import { Navigate } from "react-router-dom";

export default function NexusCommandCenter() {
  return <Navigate to="/CentralInteligencia?tab=command" replace />;
}