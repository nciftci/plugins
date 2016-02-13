/**
 * MarkAsJunk2 plugin script
 */

function rcmail_markasjunk2(prop) {
	if (!rcmail.env.uid && (!rcmail.message_list || !rcmail.message_list.get_selection().length))
		return;

	if (!prop || prop == 'markasjunk2')
		prop = 'junk';

	var prev_sel = null;

	// also select childs of (collapsed) threads
	if (rcmail.message_list) {
		if (rcmail.env.uid) {
			if (rcmail.message_list.rows[rcmail.env.uid].has_children && !rcmail.message_list.rows[rcmail.env.uid].expanded) {
				if (!rcmail.message_list.in_selection(rcmail.env.uid)) {
					prev_sel = rcmail.message_list.get_selection();
					rcmail.message_list.select_row(rcmail.env.uid);
				}

				rcmail.message_list.select_childs(rcmail.env.uid);
				rcmail.env.uid = null;
			}
			else if (rcmail.message_list.get_single_selection() == rcmail.env.uid) {
				rcmail.env.uid = null;
			}
		}
		else {
			selection = rcmail.message_list.get_selection();
			for (var i in selection) {
				if (rcmail.message_list.rows[selection[i]].has_children && !rcmail.message_list.rows[selection[i]].expanded)
					rcmail.message_list.select_childs(selection[i]);
			}
		}
	}

	var uids = rcmail.env.uid ? rcmail.env.uid : rcmail.message_list.get_selection();

	var lock = rcmail.set_busy(true, 'loading');
	rcmail.http_post('plugin.markasjunk2.' + prop, rcmail.selection_post_data({_uid: uids, _multifolder: rcmail.is_multifolder_listing()}), lock);

	if (prev_sel) {
		rcmail.message_list.clear_selection();

		for (var i in prev_sel)
			rcmail.message_list.select_row(prev_sel[i], CONTROL_KEY);
	}
}

function rcmail_markasjunk2_notjunk(prop) {
	rcmail_markasjunk2('not_junk');
}

rcube_webmail.prototype.rcmail_markasjunk2_move = function(mbox, uids) {
	var prev_uid = rcmail.env.uid;
	var prev_sel = null;
	var a_uids = $.isArray(uids) ? uids : uids.split(",");;

	if (rcmail.message_list && a_uids.length == 1 && !rcmail.message_list.rows[a_uids[0]]) {
		rcmail.env.uid = a_uids[0];
	}
	else if (rcmail.message_list && a_uids.length == 1 && !rcmail.message_list.in_selection(a_uids[0]) && !rcmail.env.threading) {
		rcmail.env.uid = a_uids[0];
		rcmail.message_list.remove_row(rcmail.env.uid, false);
	}
	else if (rcmail.message_list && (!rcmail.message_list.in_selection(a_uids[0]) || a_uids.length != rcmail.message_list.selection.length)) {
		prev_sel = rcmail.message_list.get_selection();
		rcmail.message_list.clear_selection();

		for (var i in a_uids)
			rcmail.message_list.select_row(a_uids[i], CONTROL_KEY);
	}

	if (mbox)
		rcmail.move_messages(mbox);
	else
		rcmail.delete_messages();

	rcmail.env.uid = prev_uid;

	if (prev_sel) {
		rcmail.message_list.clear_selection();

		for (var i in prev_sel) {
			if (prev_sel[i] != uid)
				rcmail.message_list.select_row(prev_sel[i], CONTROL_KEY);
		}
	}
}

function rcmail_markasjunk2_update() {
	var spamobj = $('#' + rcmail.buttons['plugin.markasjunk2.junk'][0].id);
	var hamobj = $('#' + rcmail.buttons['plugin.markasjunk2.not_junk'][0].id);

	if (spamobj.parent('li').length > 0) {
		spamobj = spamobj.parent();
		hamobj = hamobj.parent();
	}

	if (rcmail.env.markasjunk2_override || rcmail.is_multifolder_listing()) {
		spamobj.show();
		hamobj.show();
	}
	else if (rcmail.env.markasjunk2_spam_mailbox && rcmail.env.mailbox != rcmail.env.markasjunk2_spam_mailbox) {
		spamobj.show();
		hamobj.hide();
	}
	else {
		spamobj.hide();
		hamobj.show();
	}
}

$(document).ready(function() {
	if (window.rcmail) {
		rcmail.addEventListener('init', function(evt) {
			// register command (directly enable in message view mode)
			rcmail.register_command('plugin.markasjunk2.junk', rcmail_markasjunk2, rcmail.env.uid);
			rcmail.register_command('plugin.markasjunk2.not_junk', rcmail_markasjunk2_notjunk, rcmail.env.uid);

			if (rcmail.message_list) {
				rcmail.message_list.addEventListener('select', function(list) {
					rcmail.enable_command('plugin.markasjunk2.junk', list.get_selection().length > 0);
					rcmail.enable_command('plugin.markasjunk2.not_junk', list.get_selection().length > 0);
				});
			}
		});

		rcmail.addEventListener('listupdate', function(props) { rcmail_markasjunk2_update(); } );

		rcmail.addEventListener('beforemoveto', function(mbox) {
			if (mbox && typeof mbox === 'object')
				mbox = mbox.id;

			// check if destination mbox equals junk box (and we're not already in the junk box)
			if (rcmail.env.markasjunk2_move_spam && mbox && mbox == rcmail.env.markasjunk2_spam_mailbox && mbox != rcmail.env.mailbox) {
				rcmail_markasjunk2();
				return false;

			}
			// or if destination mbox equals ham box and we are in the junk box
			else if (rcmail.env.markasjunk2_move_ham && mbox && mbox == rcmail.env.markasjunk2_ham_mailbox && rcmail.env.mailbox == rcmail.env.markasjunk2_spam_mailbox) {
				rcmail_markasjunk2_notjunk();
				return false;
			}

			return;
		} );
	}
});