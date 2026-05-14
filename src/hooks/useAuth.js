import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

// Convenience hook to access auth state and actions.
export const useAuth = () => useContext(AuthContext);

