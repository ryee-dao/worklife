import { createContext, useContext } from "react";

// Lets the settings replay the tour the dashboard owns
export const TourContext = createContext<{ replay: () => void }>({ replay: () => {} });

export const useTour = () => useContext(TourContext);
