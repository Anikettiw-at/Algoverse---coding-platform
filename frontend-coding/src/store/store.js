import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../authSlice';
import battleReducer from './battleSlice'; // 👈 Naya battle slice import

export const store = configureStore({
  reducer: {
    auth: authReducer,
    battle: battleReducer // 👈 Battle state reducer added
  }
});

export default store;