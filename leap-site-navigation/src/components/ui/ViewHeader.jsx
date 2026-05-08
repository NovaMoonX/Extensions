export default function ViewHeader({ title, onBack }) {
	return (
		<div className='view-header'>
			<button className='back-btn' onClick={onBack}>
				← Back
			</button>
			<h2>{title}</h2>
		</div>
	);
}
