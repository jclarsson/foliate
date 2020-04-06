/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

pkg.initGettext()
pkg.initFormat()
pkg.require({
    'Gio': '2.0',
    'Gtk': '3.0'
})

const { Gio, Gtk } = imports.gi

const { mimetypes } = imports.utils
const { Window } = imports.window
const { customThemes, ThemeEditor, makeThemeFromSettings, applyTheme } = imports.theme

const settings = new Gio.Settings({ schema_id: pkg.name })
const viewSettings = new Gio.Settings({ schema_id: pkg.name + '.view' })

const makeActions = app => ({
    'new-theme': () => {
        const theme = makeThemeFromSettings()
        const editor = new ThemeEditor(theme)
        const dialog = editor.widget
        dialog.transient_for = app.active_window
        if (dialog.run() === Gtk.ResponseType.OK) {
            customThemes.addTheme(theme)
            applyTheme(theme)
        }
        dialog.destroy()
    },
    'preferences': () => {
        const builder = Gtk.Builder.new_from_resource(
            '/com/github/johnfactotum/Foliate/ui/preferenceWindow.ui')

        const $ = builder.get_object.bind(builder)
        const flag = Gio.SettingsBindFlags.DEFAULT

        settings.bind('restore-last-file', $('restoreLastFile'), 'state', flag)
        settings.bind('use-menubar', $('useMenubar'), 'state', flag)
        settings.bind('use-sidebar', $('useSidebar'), 'state', flag)
        settings.bind('autohide-headerbar', $('autohideHeaderbar'), 'state', flag)
        settings.bind('footer-left', $('footerLeftCombo'), 'active-id', flag)
        settings.bind('footer-right', $('footerRightCombo'), 'active-id', flag)
        settings.bind('selection-action-single', $('singleActionCombo'), 'active-id', flag)
        settings.bind('selection-action-multiple', $('multipleActionCombo'), 'active-id', flag)
        settings.bind('tts-command', $('ttsEntry'), 'text', flag)

        const showAHBox = () => {
            $('autohideHeaderbarBox').visible =
                !viewSettings.get_boolean('skeuomorphism')
                && !settings.get_boolean('use-sidebar')
        }
        showAHBox()
        const h1 = viewSettings.connect('changed::skeuomorphism', showAHBox)
        const h2 = settings.connect('changed::use-sidebar', showAHBox)

        const dialog = builder.get_object('preferenceDialog')
        dialog.transient_for = app.active_window
        dialog.run()
        dialog.destroy()
        viewSettings.disconnect(h1)
        settings.disconnect(h2)
    },
    'open': () => {
        const allFiles = new Gtk.FileFilter()
        allFiles.set_name(_('All Files'))
        allFiles.add_pattern('*')

        const epubFiles = new Gtk.FileFilter()
        epubFiles.set_name(_('E-book Files'))
        epubFiles.add_mime_type(mimetypes.epub)
        epubFiles.add_mime_type(mimetypes.mobi)
        epubFiles.add_mime_type(mimetypes.kindle)

        const dialog = Gtk.FileChooserNative.new(
            _('Open File'),
            app.active_window,
            Gtk.FileChooserAction.OPEN,
            null, null)
        dialog.add_filter(epubFiles)
        dialog.add_filter(allFiles)

        if(settings.get_string('last-folder')){
            dialog.set_current_folder(settings.get_string('last-folder'))
        }

        if (dialog.run() === Gtk.ResponseType.ACCEPT){
            settings.set_string('last-folder', dialog.get_current_folder())
            app.active_window.open(dialog.get_file())

        }
    },
    'about': () => {
        const aboutDialog = new Gtk.AboutDialog({
            authors: ['John Factotum'],
            artists: ['John Factotum'],
            translator_credits: _('translator-credits'),
            program_name: _('Foliate'),
            comments: _('A simple and modern eBook viewer'),
            logo_icon_name: pkg.name,
            version: pkg.version,
            license_type: Gtk.License.GPL_3_0,
            website: 'https://johnfactotum.github.io/foliate/',
            modal: true,
            transient_for: app.active_window
        })
        aboutDialog.run()
        aboutDialog.destroy()
    },
    'quit': () => app.get_windows().forEach(window => window.close())
})

function main(argv) {
    const application = new Gtk.Application({
        application_id: 'com.github.johnfactotum.Foliate',
        flags: Gio.ApplicationFlags.HANDLES_OPEN
    })

    application.connect('activate', () => {
        const activeWindow = application.activeWindow
            || new Window({ application })
        activeWindow.present()
    })

    application.connect('open', (_, files) => files.forEach(file => {
        const window = new Window({ application, file })
        window.present()
    }))

    application.connect('startup', () => {
        viewSettings.bind('prefer-dark-theme', Gtk.Settings.get_default(),
            'gtk-application-prefer-dark-theme', Gio.SettingsBindFlags.DEFAULT)

        const actions = makeActions(application)
        Object.keys(actions).forEach(name => {
            const action = new Gio.SimpleAction({ name })
            action.connect('activate', actions[name])
            application.add_action(action)
        })

        ;[
            ['app.quit', ['<ctrl>q']],
            ['app.open', ['<ctrl>o']],
            ['app.preferences', ['<ctrl>comma']],
            ['win.close', ['<ctrl>w']],
            ['win.reload', ['<ctrl>r']],
            ['win.open-copy', ['<ctrl>n']],
            ['win.properties', ['<ctrl>i']],
            ['win.fullscreen', ['F11']],
            ['win.unfullscreen', ['Escape']],
            ['win.side-menu', ['F9']],
            ['win.find-menu', ['<ctrl>f', 'slash']],
            ['win.main-menu', ['F10']],
            ['win.location-menu', ['<ctrl>l']],
            ['win.speak', ['F5']],
            ['win.selection-copy', ['<ctrl>c']],
            ['win.show-help-overlay', ['<ctrl>question']],
            ['view.zoom-in', ['plus', 'equal', '<ctrl>plus', '<ctrl>equal']],
            ['view.go-prev', ['p']],
            ['view.go-next', ['n']],
            ['view.go-back', ['<alt>p', '<alt>Left']],
            ['view.zoom-out', ['minus', '<ctrl>minus']],
            ['view.zoom-restore', ['0', '<ctrl>0']],
            ['view.bookmark', ['<ctrl>d']],
        ].forEach(([name, accels]) => application.set_accels_for_action(name, accels))

        const menu = Gtk.Builder.new_from_resource(
            '/com/github/johnfactotum/Foliate/ui/menuBar.ui')
            .get_object('menu')
        application.menubar = menu
    })

    return application.run(argv)
}
