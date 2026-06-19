import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/materials'
  },
  {
    path: '/materials',
    name: 'Materials',
    component: () => import('@/views/materials/List.vue'),
    meta: { title: '宣传素材', role: 'MARKETING' }
  },
  {
    path: '/materials/create',
    name: 'MaterialCreate',
    component: () => import('@/views/materials/Form.vue'),
    meta: { title: '新建素材', role: 'MARKETING' }
  },
  {
    path: '/materials/:id',
    name: 'MaterialDetail',
    component: () => import('@/views/materials/Detail.vue'),
    meta: { title: '素材详情' }
  },
  {
    path: '/materials/:id/edit',
    name: 'MaterialEdit',
    component: () => import('@/views/materials/Form.vue'),
    meta: { title: '编辑素材', role: 'MARKETING' }
  },
  {
    path: '/medical',
    name: 'MedicalReview',
    component: () => import('@/views/medical/List.vue'),
    meta: { title: '医学审核', role: 'MEDICAL' }
  },
  {
    path: '/medical/:id/review',
    name: 'MedicalReviewForm',
    component: () => import('@/views/medical/Review.vue'),
    meta: { title: '医学审核', role: 'MEDICAL' }
  },
  {
    path: '/legal',
    name: 'LegalReview',
    component: () => import('@/views/legal/List.vue'),
    meta: { title: '法务审核', role: 'LEGAL' }
  },
  {
    path: '/legal/:id/review',
    name: 'LegalReviewForm',
    component: () => import('@/views/legal/Review.vue'),
    meta: { title: '法务审核', role: 'LEGAL' }
  },
  {
    path: '/published',
    name: 'Published',
    component: () => import('@/views/published/List.vue'),
    meta: { title: '版本发布' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - 药品广告合规审查系统`;
  }
  next();
});

export default router;
