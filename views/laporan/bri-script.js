
// <script>
// // =========================
// // BRI SUBMISSION LOGIC
// // =========================

// function openModalBri() {
//   const modal = document.getElementById('modalBri');
  
//   // Populate existing data
//   const pic = "<%= data.pic_brilife || '' %>";
//   const subPicDate = "<%= data.tanggal_submit_pic ? new Date(data.tanggal_submit_pic).toISOString().split('T')[0] : '' %>";
//   const subPicTime = "<%= data.jam_submit_pic_analis || '' %>";
//   const subInvDate = "<%= data.tanggal_submit_investigator ? new Date(data.tanggal_submit_investigator).toISOString().split('T')[0] : '' %>";
//   const subInvTime = "<%= data.jam_submit_pic_investigator || '' %>";

//   document.getElementById('briPicInvestigator').value = pic;
//   document.getElementById('briSubmitPicDate').value = subPicDate;
//   document.getElementById('briSubmitPicTime').value = subPicTime;
//   document.getElementById('briSubmitInvDate').value = subInvDate;
//   document.getElementById('briSubmitInvTime').value = subInvTime;

//   modal.classList.remove('hidden');
// }

// function closeModalBri() {
//   document.getElementById('modalBri').classList.add('hidden');
// }

// async function submitBri(e) {
//   e.preventDefault();
  
//   const form = document.getElementById('formBri');
//   const formData = new FormData(form);
//   const data = Object.fromEntries(formData.entries());

//   try {
//     const response = await fetch('/laporan/<%= data.id %>/bri', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(data)
//     });

//     const result = await response.json();

//     if (result.success) {
//       alert('Data BRI berhasil disimpan!');
//       window.location.reload();
//     } else {
//       alert('Gagal menyimpan data: ' + (result.error || 'Unknown error'));
//     }
//   } catch (err) {
//     console.error(err);
//     alert('Terjadi kesalahan saat menyimpan data.');
//   }
// }

// // =========================
// // DESWA LOGIC (EXISTING)
// // =========================
// // ... existing code ...
