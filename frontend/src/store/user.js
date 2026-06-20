import { defineStore } from 'pinia';

const ROLE_USERS = {
  MARKETING: { name: 'ZhangMarket', displayName: '张市场', role: 'MARKETING', roleName: '市场部' },
  MEDICAL: { name: 'LiMedical', displayName: '李医学', role: 'MEDICAL', roleName: '医学审核' },
  LEGAL: { name: 'WangLegal', displayName: '王法务', role: 'LEGAL', roleName: '法务' }
};

const STORAGE_KEY = 'userStore';

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.currentUser) {
        return data.currentUser;
      }
    }
  } catch (e) {
    // ignore parse errors
  }
  return null;
}

function writeStorage(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentUser: user }));
  } catch (e) {
    // ignore storage errors
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    currentUser: null,
    role: 'MARKETING'
  }),

  getters: {
    isMarketing: (state) => state.role === 'MARKETING',
    isMedical: (state) => state.role === 'MEDICAL',
    isLegal: (state) => state.role === 'LEGAL'
  },

  actions: {
    setUser(user) {
      this.currentUser = user;
      this.role = user.role;
      writeStorage(user);
    },

    setRole(role) {
      const user = ROLE_USERS[role] || ROLE_USERS.MARKETING;
      this.currentUser = user;
      this.role = role;
      writeStorage(user);
    },

    initFromStorage() {
      const stored = readStorage();
      if (stored && stored.role) {
        this.currentUser = stored;
        this.role = stored.role;
      } else {
        this.setRole('MARKETING');
      }
    }
  }
});
