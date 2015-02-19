/***
 * Add necessary items to page
 */

scrobbler.renderTemplate(
	'wrapper',
	function (rendered) {
		var promise = setInterval(function() {
			if ($('.primary-header--nav').length) {
				$('.primary-header--nav').append(rendered);
				clearInterval(promise);
			}
		}, 10);
	}
);



/***
 * Tick (runs every 1 second)
 */

(function ($) {
	$.strRemove = function (theTarget, theString) {
		return $("<div/>").append(
			$(theTarget, theString).remove().end()
		).html();
	};
})(jQuery);

scrobbler.tick = function() {

	var $player = $('.omniplayer');

	// Get playing state
	scrobbler.isPlaying = $player.hasClass('is-playing');

	// Get basic track info
	var $trackParts = $player.find('A.omniplayer--title'),
		$trackParts2 = $trackParts.clone(),
		credits = $trackParts.find('SPAN').html().trim();

	$trackParts2.children().remove();

	var track = $trackParts2.html().trim();

	scrobbler.track = track + (credits.toLocaleLowerCase() !== 'original mix' ? ' (' + credits + ')' : '');
	scrobbler.artist = $player.find('.omniplayer--artist').text().trim().replace(/(\r\n|\n|\r)/gm, '').replace(/\s+/g, ' ');

	// Compare track info with previous tick to check is it was changed
	scrobbler.trackChanged = scrobbler.track !== scrobbler.prevTrack || scrobbler.artist !== scrobbler.prevArtist;

	if (scrobbler.trackChanged) {
		scrobbler.playingTime = 1;
	} else {
		scrobbler.playingTime++;
	}

	// And keep current track info to compare it in next tick
	scrobbler.prevTrack = scrobbler.track;
	scrobbler.prevArtist = scrobbler.artist;

	// It seems user is logged in
	if (localStorage['scrobbler-name']) {

		if (scrobbler.isPlaying) {

			// DOM arrangements
			$('.scrobbler-artist').html(scrobbler.artist);
			$('.scrobbler-track').html(scrobbler.track);

			// Timeout bar animations
			var $timeoutBar = $('.scrobbler-timeout-bar'),
				percentage = scrobbler.playingTime / scrobbler.scrobbleTime;
			if (percentage < 1 && localStorage['scrobbler-state'] !== 'paused') {
				$timeoutBar.stop().fadeIn(500);
				$('.scrobbler-timeout-finished').stop().animate({width: $timeoutBar.width() * percentage}, 1000, 'linear');
			} else {
				$timeoutBar.stop().fadeOut(500);
			}

			// Now is the time to submit track!
			if (scrobbler.playingTime === scrobbler.scrobbleTime && localStorage['scrobbler-state'] !== 'paused') {
				scrobbler.askLastFm(
					{
						method: 'track.scrobble',
						artist: scrobbler.artist,
						track: scrobbler.track,
						timestamp: parseInt(Date.now() / 1000),
						sk: localStorage['scrobbler-key']
					},
					function () {
						console.log('Chrome Beatport Scrobbler. ' + scrobbler.track + ' by ' + scrobbler.artist + ' was submitted to Last.fm for ' + localStorage['scrobbler-name'] + '.');
					}
				);
			}

		}

	}

};



/***
 * Bindings and Initialization
 */

$('BODY')
	.on('click', '.scrobbler-caller', function () {

		$('.scrobbler-caller').addClass('active');

		if (!localStorage['scrobbler-name']) {

			scrobbler.renderTemplate(
				'login',
				'.scrobbler-container'
			);

		} else {

			scrobbler.renderTemplate(
				'main',
				function (rendered) {
					$('.scrobbler-container').html(rendered);

					if (scrobbler.isPlaying) {
						$('.scrobbler-nothingPlaying').hide();
						$('.scrobbler-nowPlaying').show();

						var $scrobblerStatePause = $('.scrobbler-state-pause'),
							$scrobblerStateResume = $('.scrobbler-state-resume');

						if (localStorage['scrobbler-state'] !== 'paused') {
							$scrobblerStatePause.show();
							$scrobblerStateResume.hide();
						} else {
							$scrobblerStatePause.hide();
							$scrobblerStateResume.show();
						}
					} else {
						$('.scrobbler-nothingPlaying').show();
						$('.scrobbler-nowPlaying').hide();
					}
				},
				{
					"artist": scrobbler.artist,
					"track": scrobbler.track,
					"username": localStorage['scrobbler-name']
				});

		}

	})
	.on('click', '.scrobbler-login', function(e) {
		e.preventDefault();

		window.location.href = 'http://www.last.fm/api/auth/?api_key=' + scrobbler.key + '&cb=' + window.location.href;
	})
	.on('click', '.scrobbler-close', function(e) {
		e.preventDefault();

		$('.scrobbler-caller').removeClass('active');
		$('.scrobbler-container').html('');
	})
	.on('click', '.scrobbler-state-pause', function(e) {
		e.preventDefault();

		localStorage['scrobbler-state'] = 'paused';
		$('.scrobbler-state-pause').hide();
		$('.scrobbler-state-resume').show();
	})
	.on('click', '.scrobbler-state-resume', function(e) {
		e.preventDefault();

		scrobbler.playingTime = 1;

		localStorage.removeItem('scrobbler-state');
		$('.scrobbler-state-pause').show();
		$('.scrobbler-state-resume').hide();
	})
	.on('click', '.scrobbler-settings', function(e) {
		e.preventDefault();

		scrobbler.renderTemplate(
			'settings',
			function (rendered) {
				$('.scrobbler-container').html(rendered);

				$('.scrobbler-settings-timeout').on('change', function() {
					var newScrobbleTime = parseInt($('.scrobbler-settings-timeout').val(), 10);

					if (newScrobbleTime < 5) {
						newScrobbleTime = 5;
					}

					if (newScrobbleTime > 180) {
						newScrobbleTime = 180;
					}

					scrobbler.scrobbleTime = newScrobbleTime;

					chrome.storage.sync.set({
						'scrobbleTime': newScrobbleTime
					});
				});

				$('.scrobbler-settings-bound-likes').on('change', function () {
					scrobbler.boundLikes = $('.scrobbler-settings-bound-likes').prop('checked');
					chrome.storage.sync.set({
						'boundLikes': scrobbler.boundLikes
					});
				})
			},
			{
				"timeout": scrobbler.scrobbleTime,
				"boundLikes": scrobbler.boundLikes ? true : false
			}
		);
	})
	.on('click', '.scrobbler-logout', function(e) {
		e.preventDefault();

		localStorage.removeItem('scrobbler-key');
		localStorage.removeItem('scrobbler-name');

		$('.scrobbler-container').html('');
		$('.scrobbler-timeout-bar').hide();
	})
	.on('click', '.omniplayer--heart-icon', function() {
		if (scrobbler.boundLikes) {
			var that = this;
			setTimeout(function () {
				if ($(that).hasClass('icon-omni-heart-hearted')) {
					scrobbler.askLastFm(
						{
							method: 'track.love',
							artist: scrobbler.artist,
							track: scrobbler.track,
							sk: localStorage['scrobbler-key']
						},
						function () {
							console.log('Chrome Beatport Scrobbler. ' + scrobbler.track + ' by ' + scrobbler.artist + ' was loved on Last.fm by ' + localStorage['scrobbler-name'] + '.');
						}
					);
				} else {
					scrobbler.askLastFm(
						{
							method: 'track.unlove',
							artist: scrobbler.artist,
							track: scrobbler.track,
							sk: localStorage['scrobbler-key']
						},
						function () {
							console.log('Chrome Beatport Scrobbler. ' + scrobbler.track + ' by ' + scrobbler.artist + ' was unloved on Last.fm by ' + localStorage['scrobbler-name'] + '.');
						}
					);
				}
			}, 10);
		}
	});


$(window).ready(function() {

	// It seems user is back from Last.fm with confirmed API usage request.
	// Ok! Trying to get and store username and key for further requests
	if (scrobbler.getSearchParameters().token) {
		scrobbler.askLastFm(
			{
				method: 'auth.getSession',
				token: scrobbler.getSearchParameters().token
			},
			function (data) {

				// Yes! We have something to keep
				var $xml = $(data);
				localStorage['scrobbler-name'] = $xml.find('name').text();
				localStorage['scrobbler-key'] = $xml.find('key').text();

			}
		);
	}

	// Get user preferences (and setting defaults)
	scrobbler.scrobbleTime = 30;
	chrome.storage.sync.get('scrobbleTime', function(data) {
		if (data.scrobbleTime) {
			scrobbler.scrobbleTime = data.scrobbleTime;
		}
	});

	scrobbler.boundLikes = false;
	chrome.storage.sync.get('boundLikes', function(data) {
		if (data.boundLikes) {
			scrobbler.boundLikes = data.boundLikes;
		}
	});

	setInterval(scrobbler.tick, 1000);

});
