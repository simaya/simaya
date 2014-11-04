module.exports = function() {
  return {
   'suratmasuk': [ 
      {
        icon: 'icon-envelope',
        text: 'Surat Masuk',
        route: '/incoming',
        id: 'incoming',
        submenu: [
          {text: 'Surat Masuk', route: '/incoming'},
          {text: 'Tembusan', route: '/incoming/cc'},
          {text: 'Disposisi Masuk', route: '/dispositions'},
          {text: 'Disposisi Tembusan', route: '/dispositions/cc'}
        ]
      }
    ],
    'suratkeluar': [
      {
        icon: 'icon-envelope-alt',
        text: 'Surat Keluar',
        route: '',
        id: 'outgoing',
        submenu: [
          {text: 'Surat Keluar', route: '/outgoing'},
          {text: 'Konsep', route: '/outgoing/draft'},
          {text: 'Batal', route: '/outgoing/cancel'},
          {text: 'Buat Surat', route: '/outgoing/new'},
          {text: 'Disposisi Keluar', route: '/dispositions/outgoing'},
        ]
      }
    ],
    'plh': [
      {
        icon: 'icon-group',
        text: 'PLH',
        route: '/deputy',
        id: 'deputy',
        submenu: [
          {text: 'PLH', route: '/deputy'},
        ]
      }
    ],
    'template': [
      {
        icon: 'icon-copy',
        text: 'Template',
        route: '/templates',
        id: 'templates',
        submenu: [
          {text: 'Template', route: '/templates'},
        ]
      }
    ],
    'agenda': [
      {
        icon: 'icon-list-alt',
        text: 'Agenda',
        route: '',
        id: 'agenda',
        submenu: [
          {text: 'Agenda Masuk', route: '/agenda/incoming'},
          {text: 'Agenda Keluar', route: '/agenda/outgoing'},
          {text: 'Surat Masuk Manual', route: '/incoming/external', onlyShowInRoles: ["tatausaha"]},
          {text: 'Surat Keluar Manual', route: '/outgoing/external', onlyShowInRoles: ["tatausaha"]}
        ]
      }
    ],

  }
}();
