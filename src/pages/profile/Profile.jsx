import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import Loader from '../../components/ui/Loader.jsx';
import ProfileSheet from '../../components/profile/ProfileSheet.jsx';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(true);

  if (!user) return <Loader />;

  const handleClose = () => {
    setOpen(false);
    navigate(dashboardPathForRole(user.activeRole ?? user.roles?.[0]), { replace: true });
  };

  return <ProfileSheet open={open} onClose={handleClose} />;
};

export default Profile;
