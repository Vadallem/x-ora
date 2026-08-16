// Función para alternar entre el enfoque industrial y el enfoque educativo
function switchTab(tabId) {
    // 1. Ocultar todas las secciones de contenido
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 2. Reiniciar los estilos visuales de los botones en las pestañas
    document.getElementById('btn-services').classList.remove('active-services');
    document.getElementById('btn-studio').classList.remove('active-studio');
    
    // 3. Activar la sección seleccionada
    document.getElementById(tabId).classList.add('active');
    
    // 4. Aplicar el color y estado de activo al botón correspondiente
    if (tabId === 'services') {
        document.getElementById('btn-services').classList.add('active-services');
    } else if (tabId === 'studio') {
        document.getElementById('btn-studio').classList.add('active-studio');
    }
}