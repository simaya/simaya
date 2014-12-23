$(document).ready(function() {
  $('input[name="profile[id]"]').keydown(function(event) {
    // Allow: backspace, delete, tab, escape, and enter
    if ( event.keyCode == 46 || event.keyCode == 8 || event.keyCode == 9 || event.keyCode == 27 || event.keyCode == 13 || 
      // Allow: Ctrl+A
      (event.keyCode == 65 && event.ctrlKey === true) || 
      // Allow: home, end, left, right
      (event.keyCode >= 35 && event.keyCode <= 39)) {
        // let it happen, don't do anything
        return;
      } else {
      // Ensure that it is a number and stop the keypress
      if (event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105 )) {
        event.preventDefault(); 
      }   
    }
  });
  $('input[name="profile[id]"]').keyup(function(event) {
    if ( event.which == 13 ) {
      event.preventDefault();
    }
    var counter = $('input[name="profile[id]"]').val().length;
    console.log(counter);
    if (counter > 18 || counter < 18) {
      $('#nip-control').addClass('error');
      $('#nip-help-inline').html('NIP harus 18 angka');
    } else if (counter == 18) {
      $('#nip-control').removeClass('error');
      $('#nip-help-inline').html('');
    }
  });


  $('select[name="profile[echelon]"]').change(function() {
    var value = parseInt($(this).attr('value'));
    if (value == 0) {
      $('#nip-control').hide();
      $('#class').hide();
    } else {
      $('#nip-control').show();
      $('#class').show();
    }
  });
  $('select[name="profile[echelon]"]').change();
});
