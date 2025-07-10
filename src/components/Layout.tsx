import React from 'react';
import { Box, Container } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
