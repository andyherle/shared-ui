/** Generic synthetic targets only. Private applications own their registrations. */
export const DEMO_APPEARANCE_REGISTRY = {
  schemaVersion: 1, id: 'demo-appearance', revision: 1,
  modules: [
    {id: 'demo.panel', label: 'Colour panel', description: 'Panel dimensions and spacing on an existing native form.',
      selector: '#appearanceDemoPanel',
      source: {path: 'src/appearance/editor.css', cssText: '.appearance-demo-panel {\n  width: var(--demo-panel-width, 320px);\n  max-width: 100%;\n  border-radius: var(--demo-panel-radius, 8px);\n  padding: var(--demo-panel-padding, 16px);\n}'},
      controls: [
        {property: '--demo-panel-width', label: 'Panel width', type: 'length', unit: 'px', min: 240, max: 560, default: '320px'},
        {property: '--demo-panel-radius', label: 'Corner radius', type: 'length', unit: 'px', min: 0, max: 24, default: '8px'},
        {property: '--demo-panel-padding', label: 'Inner spacing', type: 'length', unit: 'px', min: 8, max: 32, default: '16px'}
      ]},
    {id: 'demo.grip', label: 'Drag indicator', description: 'Visible indicator only; the existing interactive region stays in place.',
      selector: '#appearanceDemoGrip',
      source: {path: 'src/appearance/editor.css', cssText: '.appearance-demo-grip {\n  width: var(--demo-grip-width, 32px);\n  height: var(--demo-grip-height, 4px);\n  opacity: var(--demo-grip-opacity, .5);\n  pointer-events: none;\n}'},
      controls: [
        {property: '--demo-grip-width', label: 'Indicator width', type: 'length', unit: 'px', min: 8, max: 64, default: '32px'},
        {property: '--demo-grip-height', label: 'Indicator height', type: 'length', unit: 'px', min: 2, max: 12, default: '4px'},
        {property: '--demo-grip-opacity', label: 'Indicator opacity', type: 'number', min: 0, max: 1, default: '0.5'}
      ]}
  ]
};
