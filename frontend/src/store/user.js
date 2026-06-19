import { defineStore } from 'pinia';

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
      localStorage.setItem('userStore', JSON.stringify({ currentUser: user }));
    },
    
    setRole(role) {
      this.role = role;
      const users = {
        MARKETING: { name: '张市场', role: 'MARKETING', roleName: '市场部' },
        MEDICAL: { name: '李医学', role: 'MEDICAL', roleName: '医学审核' },
        LEGAL: { name: '王法务', role: 'LEGAL', roleName: '法务' }
      };
      this.currentUser = users[role];
      localStorage.setItem('userStore', JSON.stringify({ currentUser: this.currentUser }));
    },
    
    initFromStorage() {
      try {
        const stored = localStorage.getItem('userStore');
        if (stored) {
          const data = JSON.parse(stored);
          if (data.currentUser) {
            this.currentUser = data.currentUser;
            this.role = data.currentUser.role;
          }
        }
        if (!this.currentUser) {
          this.setRole('MARKETING');
        }
      } catch (e) {
        this.setRole('MARKETING');
      }
    }
  }
});
