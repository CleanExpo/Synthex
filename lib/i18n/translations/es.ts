/**
 * Spanish translations
 */

export const es = {
  common: {
    // Actions
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    update: 'Actualizar',
    submit: 'Enviar',
    search: 'Buscar',
    filter: 'Filtrar',
    sort: 'Ordenar',
    export: 'Exportar',
    import: 'Importar',
    upload: 'Subir',
    download: 'Descargar',
    refresh: 'Actualizar',
    close: 'Cerrar',
    back: 'Atrás',
    next: 'Siguiente',
    previous: 'Anterior',
    confirm: 'Confirmar',
    
    // Status
    loading: 'Cargando...',
    processing: 'Procesando...',
    success: 'Éxito',
    error: 'Error',
    warning: 'Advertencia',
    info: 'Información',
    
    // Time
    today: 'Hoy',
    yesterday: 'Ayer',
    tomorrow: 'Mañana',
    week: 'Semana',
    month: 'Mes',
    year: 'Año',
    
    // General
    yes: 'Sí',
    no: 'No',
    all: 'Todo',
    none: 'Ninguno',
    select: 'Seleccionar',
    selected: 'Seleccionado',
    items: 'elementos',
    results: 'Resultados',
    noResults: 'No se encontraron resultados',
    noData: 'No hay datos disponibles',
  },
  
  auth: {
    signIn: 'Iniciar Sesión',
    signUp: 'Registrarse',
    signOut: 'Cerrar Sesión',
    email: 'Correo',
    password: 'Contraseña',
    confirmPassword: 'Confirmar Contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetPassword: 'Restablecer Contraseña',
    rememberMe: 'Recordarme',
    orContinueWith: 'O continúa con',
    alreadyHaveAccount: '¿Ya tienes una cuenta?',
    dontHaveAccount: '¿No tienes una cuenta?',
    termsAndConditions: 'Términos y Condiciones',
    privacyPolicy: 'Política de Privacidad',
    
    errors: {
      invalidCredentials: 'Correo o contraseña inválidos',
      userNotFound: 'Usuario no encontrado',
      emailAlreadyExists: 'El correo ya existe',
      weakPassword: 'La contraseña es muy débil',
      passwordMismatch: 'Las contraseñas no coinciden',
      invalidEmail: 'Dirección de correo inválida',
    },
    
    success: {
      signInSuccess: 'Sesión iniciada exitosamente',
      signUpSuccess: 'Cuenta creada exitosamente',
      signOutSuccess: 'Sesión cerrada exitosamente',
      passwordResetSent: 'Correo de restablecimiento enviado',
      passwordChanged: 'Contraseña cambiada exitosamente',
    },
  },
  
  dashboard: {
    title: 'Panel de Control',
    welcome: '¡Bienvenido de vuelta, {{name}}!',
    overview: 'Resumen',
    analytics: 'Analíticas',
    performance: 'Rendimiento',
    reports: 'Reportes',
    
    metrics: {
      totalCampaigns: 'Campañas Totales',
      activeProjects: 'Proyectos Activos',
      engagement: 'Tasa de Participación',
      conversion: 'Tasa de Conversión',
      reach: 'Alcance Total',
      impressions: 'Impresiones',
    },
    
    charts: {
      performanceOverTime: 'Rendimiento en el Tiempo',
      topPerformingContent: 'Contenido de Mayor Rendimiento',
      audienceGrowth: 'Crecimiento de Audiencia',
      engagementByPlatform: 'Participación por Plataforma',
    },
  },
  
  campaigns: {
    title: 'Campañas',
    createCampaign: 'Crear Campaña',
    editCampaign: 'Editar Campaña',
    deleteCampaign: 'Eliminar Campaña',
    campaignName: 'Nombre de Campaña',
    campaignType: 'Tipo de Campaña',
    startDate: 'Fecha de Inicio',
    endDate: 'Fecha de Fin',
    budget: 'Presupuesto',
    status: 'Estado',
    
    types: {
      social: 'Redes Sociales',
      email: 'Marketing por Email',
      content: 'Marketing de Contenido',
      paid: 'Publicidad Pagada',
      influencer: 'Marketing de Influencers',
      seo: 'SEO',
    },
    
    statuses: {
      draft: 'Borrador',
      scheduled: 'Programada',
      active: 'Activa',
      paused: 'Pausada',
      completed: 'Completada',
      archived: 'Archivada',
    },
    
    messages: {
      created: 'Campaña creada exitosamente',
      updated: 'Campaña actualizada exitosamente',
      deleted: 'Campaña eliminada exitosamente',
      scheduled: 'Campaña programada exitosamente',
      activated: 'Campaña activada',
      paused: 'Campaña pausada',
    },
  },
  
  content: {
    title: 'Contenido',
    createPost: 'Crear Publicación',
    editPost: 'Editar Publicación',
    schedule: 'Programar',
    publish: 'Publicar',
    preview: 'Vista Previa',
    
    editor: {
      title: 'Título',
      content: 'Contenido',
      description: 'Descripción',
      tags: 'Etiquetas',
      category: 'Categoría',
      featuredImage: 'Imagen Destacada',
      seoTitle: 'Título SEO',
      seoDescription: 'Descripción SEO',
      keywords: 'Palabras Clave',
    },
    
    ai: {
      generateContent: 'Generar con IA',
      improveContent: 'Mejorar Contenido',
      suggestHashtags: 'Sugerir Hashtags',
      optimizeForSEO: 'Optimizar para SEO',
      generateCaption: 'Generar Pie de Foto',
      rewrite: 'Reescribir',
      expand: 'Expandir',
      summarize: 'Resumir',
    },
  },
  
  analytics: {
    title: 'Analíticas',
    overview: 'Resumen',
    realtime: 'Tiempo Real',
    audience: 'Audiencia',
    acquisition: 'Adquisición',
    behavior: 'Comportamiento',
    conversions: 'Conversiones',
    
    metrics: {
      users: 'Usuarios',
      sessions: 'Sesiones',
      pageviews: 'Vistas de Página',
      bounceRate: 'Tasa de Rebote',
      avgSessionDuration: 'Duración Promedio de Sesión',
      conversionRate: 'Tasa de Conversión',
      revenue: 'Ingresos',
      transactions: 'Transacciones',
    },
    
    periods: {
      last7Days: 'Últimos 7 días',
      last30Days: 'Últimos 30 días',
      last90Days: 'Últimos 90 días',
      lastYear: 'Último año',
      custom: 'Rango personalizado',
    },
  },
  
  team: {
    title: 'Equipo',
    members: 'Miembros del Equipo',
    inviteMembers: 'Invitar Miembros',
    roles: 'Roles',
    permissions: 'Permisos',
    
    roles: {
      owner: 'Propietario',
      admin: 'Administrador',
      editor: 'Editor',
      viewer: 'Visualizador',
      contributor: 'Colaborador',
    },
    
    actions: {
      invite: 'Invitar',
      remove: 'Remover',
      changeRole: 'Cambiar Rol',
      resendInvite: 'Reenviar Invitación',
      cancelInvite: 'Cancelar Invitación',
    },
    
    messages: {
      invited: 'Invitación enviada exitosamente',
      removed: 'Miembro removido exitosamente',
      roleChanged: 'Rol cambiado exitosamente',
      inviteResent: 'Invitación reenviada',
      inviteCanceled: 'Invitación cancelada',
    },
  },
  
  settings: {
    title: 'Configuración',
    general: 'General',
    profile: 'Perfil',
    account: 'Cuenta',
    notifications: 'Notificaciones',
    security: 'Seguridad',
    billing: 'Facturación',
    integrations: 'Integraciones',
    api: 'API',
    
    profile: {
      name: 'Nombre',
      email: 'Correo',
      phone: 'Teléfono',
      bio: 'Biografía',
      avatar: 'Avatar',
      timezone: 'Zona Horaria',
      language: 'Idioma',
      dateFormat: 'Formato de Fecha',
    },
    
    notifications: {
      email: 'Notificaciones por Correo',
      push: 'Notificaciones Push',
      desktop: 'Notificaciones de Escritorio',
      marketing: 'Correos de Marketing',
      updates: 'Actualizaciones de Producto',
      tips: 'Consejos y Tutoriales',
    },
    
    security: {
      changePassword: 'Cambiar Contraseña',
      twoFactor: 'Autenticación de Dos Factores',
      sessions: 'Sesiones Activas',
      apiKeys: 'Claves API',
      activityLog: 'Registro de Actividad',
    },
  },
  
  errors: {
    generic: 'Algo salió mal. Por favor, inténtalo de nuevo.',
    network: 'Error de red. Por favor, verifica tu conexión.',
    notFound: 'Página no encontrada',
    unauthorized: 'No estás autorizado para realizar esta acción',
    forbidden: 'Acceso prohibido',
    serverError: 'Error del servidor. Por favor, inténtalo más tarde.',
    validation: 'Por favor, verifica tu entrada e inténtalo de nuevo.',
    
    404: {
      title: 'Página No Encontrada',
      message: 'La página que buscas no existe.',
      action: 'Ir al Panel',
    },
    
    500: {
      title: 'Error del Servidor',
      message: 'Algo salió mal de nuestro lado.',
      action: 'Intentar de Nuevo',
    },
  },
  
  validation: {
    required: 'Este campo es requerido',
    email: 'Por favor, ingresa un correo válido',
    minLength: 'Debe tener al menos {{count}} caracteres',
    maxLength: 'No debe tener más de {{count}} caracteres',
    minValue: 'Debe ser al menos {{value}}',
    maxValue: 'No debe ser más de {{value}}',
    pattern: 'Formato inválido',
    url: 'Por favor, ingresa una URL válida',
    phone: 'Por favor, ingresa un número de teléfono válido',
    number: 'Por favor, ingresa un número válido',
    integer: 'Por favor, ingresa un número entero',
    decimal: 'Por favor, ingresa un número decimal válido',
    date: 'Por favor, ingresa una fecha válida',
    time: 'Por favor, ingresa una hora válida',
    datetime: 'Por favor, ingresa una fecha y hora válidas',
    fileSize: 'El tamaño del archivo debe ser menor a {{size}}',
    fileType: 'Tipo de archivo no soportado',
  },
  
  notifications: {
    success: {
      saved: 'Guardado exitosamente',
      updated: 'Actualizado exitosamente',
      deleted: 'Eliminado exitosamente',
      uploaded: 'Subido exitosamente',
      sent: 'Enviado exitosamente',
      copied: 'Copiado al portapapeles',
    },
    
    error: {
      save: 'Error al guardar',
      update: 'Error al actualizar',
      delete: 'Error al eliminar',
      upload: 'Error al subir',
      send: 'Error al enviar',
      copy: 'Error al copiar',
    },
    
    info: {
      processing: 'Procesando tu solicitud...',
      uploading: 'Subiendo archivo...',
      downloading: 'Descargando archivo...',
      loading: 'Cargando datos...',
    },
    
    warning: {
      unsavedChanges: 'Tienes cambios sin guardar',
      confirmDelete: '¿Estás seguro de que quieres eliminar esto?',
      confirmLogout: '¿Estás seguro de que quieres cerrar sesión?',
    },
  },
  
  footer: {
    copyright: '© {{year}} SYNTHEX. Todos los derechos reservados.',
    terms: 'Términos',
    privacy: 'Privacidad',
    support: 'Soporte',
    docs: 'Documentación',
    blog: 'Blog',
    about: 'Acerca de',
    contact: 'Contacto',
  },
};

export default es;